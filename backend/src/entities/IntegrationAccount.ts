import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User";

@Entity("integration_accounts")
@Index(["userId", "provider"], { unique: true })
export class IntegrationAccount {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "varchar", length: 50 })
  provider!: string; // e.g. "google"

  @Column({ type: "text", name: "access_token" })
  accessToken!: string;

  @Column({ type: "text", name: "refresh_token", nullable: true })
  refreshToken!: string | null;

  @Column({ type: "timestamptz", name: "expires_at", nullable: true })
  expiresAt!: Date | null;

  @Column({ type: "text", nullable: true })
  scope!: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
