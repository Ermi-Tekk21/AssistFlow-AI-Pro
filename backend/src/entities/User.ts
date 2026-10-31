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