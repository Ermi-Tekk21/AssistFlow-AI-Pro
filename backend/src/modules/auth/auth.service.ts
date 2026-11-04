import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../config/database";
import { User } from "../../entities/User";
import { ForbiddenError, NotFoundError, UnauthorizedError, BadRequestError } from "../../middleware/errors";
import { JWT_SECRET } from "../../middleware/auth";

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  dailyBriefingTime?: string | null;
  dailyBriefingEnabled?: boolean;
  timezone?: string;
}

export class AuthService {
  private userRepo = AppDataSource.getRepository(User);

  /**
   * Seed or synchronize the default user Ermias Teklemarkos (ermias@gmail.com).
   */
  public async seedDefaultUser(): Promise<User> {
    const defaultEmail = "ermias@gmail.com";
    let user = await this.userRepo.findOne({
      where: { email: defaultEmail },
    });

    const hashedPassword = await bcrypt.hash("password123", 10);

    if (!user) {
      user = this.userRepo.create({
        email: defaultEmail,
        firstName: "Ermias",
        lastName: "Teklemarkos",
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
        user.firstName = "Ermias";
        modified = true;
      }
      if (!user.lastName) {
        user.lastName = "Teklemarkos";
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

    return user;
  }

  /**
   * Sign-in restricted to the default administrator (ermias@gmail.com).
   */
  public async login(
    email: string,
    password: string
  ): Promise<{ token: string; user: Omit<User, "passwordHash"> }> {
    if (!email || !password) {
      throw new BadRequestError("Email and password are required.");
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Restriction check per requirements: only default user is permitted
    if (normalizedEmail !== "ermias@gmail.com") {
      throw new ForbiddenError(
        "Sign-in is currently restricted to the default account (ermias@gmail.com). Self-serve registration is coming soon."
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
