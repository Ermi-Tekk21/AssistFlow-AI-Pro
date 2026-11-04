import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddUserAuthAndProfileFields1793550000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("users", [
      new TableColumn({
        name: "first_name",
        type: "varchar",
        length: "100",
        isNullable: true,
      }),
      new TableColumn({
        name: "last_name",
        type: "varchar",
        length: "100",
        isNullable: true,
      }),
      new TableColumn({
        name: "password_hash",
        type: "varchar",
        length: "255",
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("users", "password_hash");
    await queryRunner.dropColumn("users", "last_name");
    await queryRunner.dropColumn("users", "first_name");
  }
}
