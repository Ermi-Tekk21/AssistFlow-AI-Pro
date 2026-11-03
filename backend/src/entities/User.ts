import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email!: string;

  @Column({ name: "first_name", type: "varchar", length: 100, nullable: true })
  firstName!: string | null;

  @Column({ name: "last_name", type: "varchar", length: 100, nullable: true })
  lastName!: string | null;

  @Column({ name: "password_hash", type: "varchar", length: 255, nullable: true })
  passwordHash!: string | null;

  @Column({
    type: "varchar",
    length: 100,
    default: "Africa/Addis_Ababa",
  })
  timezone!: string;

  @Column({ type: "time", nullable: true })
  dailyBriefingTime!: string | null;

  @Column({ type: "boolean", default: false })
  dailyBriefingEnabled!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}