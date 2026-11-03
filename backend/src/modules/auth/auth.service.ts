import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../config/database";
import { User } from "../../entities/User";
import { IntegrationAccount } from "../../entities/IntegrationAccount";
import { ForbiddenError, NotFoundError, UnauthorizedError, BadRequestError } from "../../middleware/errors";
import { JWT_SECRET } from "../../middleware/auth";

export const getDefaultEmail = (): string =>
  (process.env.DEFAULT_USER_EMAIL || "ermiasteklemarkos@gmail.com").trim().toLowerCase();

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  dailyBriefingTime?: string | null;
  dailyBriefingEnabled?: boolean;
  timezone?: string;
}

export class AuthService {
  private userRepo = AppDataSource.getRepository(User);
  private accountRepo = AppDataSource.getRepository(IntegrationAccount);

  /**
   * Seed or synchronize the default administrator account from environment configuration.
   */
  public async seedDefaultUser(): Promise<User> {
    const defaultEmail = getDefaultEmail();
    const defaultFirstName = process.env.DEFAULT_USER_FIRST_NAME || "Ermias";
    const defaultLastName = process.env.DEFAULT_USER_LAST_NAME || "Teklemarkos";
    const rawPassword = process.env.DEFAULT_USER_PASSWORD || "password123";

    let user = await this.userRepo.findOne({
      where: { email: defaultEmail },
    });

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    if (!user) {
      user = this.userRepo.create({
        email: defaultEmail,
        firstName: defaultFirstName,
        lastName: defaultLastName,
        passwordHash: hashedPassword,
        timezone: "Africa/Addis_Ababa",
        dailyBriefingTime: "08:00:00",
        dailyBriefingEnabled: true,
      });
      user = await this.userRepo.save(user);
      console.log(`[AuthService] Seeded default user: ${user.email} (${user.id})`);
    } else {
      let modified = false;
      if (!user.firstName) {
        user.firstName = defaultFirstName;
        modified = true;
      }
      if (!user.lastName) {
        user.lastName = defaultLastName;
        modified = true;
      }
      if (!user.passwordHash) {
        user.passwordHash = hashedPassword;
        modified = true;
      }
      if (modified) {
        user = await this.userRepo.save(user);
        console.log(`[AuthService] Synchronized default user credentials: ${user.email}`);
      }
    }

    // If GOOGLE_REFRESH_TOKEN is provided in environment, seed or update IntegrationAccount
    const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
    if (googleRefreshToken) {
      let googleAccount = await this.accountRepo.findOne({
        where: { userId: user.id, provider: "google" },
      });

      if (!googleAccount) {
        googleAccount = this.accountRepo.create({
          userId: user.id,
          provider: "google",
          accessToken: "initial-token-pending-refresh",
          refreshToken: googleRefreshToken,
          expiresAt: new Date(Date.now() - 10000), // forces immediate refresh
          scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
        });
        await this.accountRepo.save(googleAccount);
        console.log(`[AuthService] Seeded Google IntegrationAccount from env for ${user.email}`);
      } else if (googleAccount.refreshToken !== googleRefreshToken) {
        googleAccount.refreshToken = googleRefreshToken;
        googleAccount.expiresAt = new Date(Date.now() - 10000);
        await this.accountRepo.save(googleAccount);
        console.log(`[AuthService] Updated Google IntegrationAccount refreshToken for ${user.email}`);
      }
    }

    return user;
  }

  /**
   * Sign-in restricted to the configured default administrator account.
   */
  public async login(
    email: string,
    password: string
  ): Promise<{ token: string; user: Omit<User, "passwordHash"> }> {
    if (!email || !password) {
      throw new BadRequestError("Email and password are required.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const defaultEmail = getDefaultEmail();

    // Restriction check per requirements: only default user is permitted
    if (normalizedEmail !== defaultEmail) {
      throw new ForbiddenError(
        `Sign-in is currently restricted to the default account (${defaultEmail}). Self-serve registration is coming soon.`
      );
    }

    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    // Sign single JWT access token (no refresh token required)
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const { passwordHash: _, ...safeUser } = user;
    return {
      token,
      user: safeUser as Omit<User, "passwordHash">,
    };
  }

  /**
   * Retrieve currently authenticated user profile.
   */
  public async getMe(userId: string): Promise<Omit<User, "passwordHash">> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError("User not found.");
    }
    const { passwordHash: _, ...safeUser } = user;
    return safeUser as Omit<User, "passwordHash">;
  }

  /**
   * Update profile fields (email is strictly immutable).
   */
  public async updateProfile(
    userId: string,
    updates: UpdateProfileInput
  ): Promise<Omit<User, "passwordHash">> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError("User not found.");
    }

    if (updates.firstName !== undefined) {
      user.firstName = updates.firstName.trim();
    }
    if (updates.lastName !== undefined) {
      user.lastName = updates.lastName.trim();
    }
    if (updates.dailyBriefingTime !== undefined) {
      user.dailyBriefingTime = updates.dailyBriefingTime;
    }
    if (updates.dailyBriefingEnabled !== undefined) {
      user.dailyBriefingEnabled = updates.dailyBriefingEnabled;
    }
    if (updates.timezone !== undefined) {
      user.timezone = updates.timezone.trim();
    }

    // Note: user.email is NEVER updated here, keeping it immutable.

    const saved = await this.userRepo.save(user);
    const { passwordHash: _, ...safeUser } = saved;
    return safeUser as Omit<User, "passwordHash">;
  }
}

export const authService = new AuthService();
