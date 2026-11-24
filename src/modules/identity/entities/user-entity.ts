import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base-entity';


// hold all unique details about the user
@Entity('users')
export class User extends BaseEntity {
  @Column({
    name: 'name',
    type: 'text',
    nullable: false,
  })
  name!: string;

  @Column({
    name: 'email',
    type: 'citext',
    unique: true,
  })
  email!: string;

  @Column({
    name: 'email_verified',
    type: 'boolean',
  })
  emailVerified!: boolean;

  @Column({ name: 'email_verified_at', type: 'timestamp', nullable: true })
  emailVerifiedAt?: Date;

  @Column({
    name: 'username',
    type: 'citext',
  })
  username!: string;

  @Column({
    name: 'phone_number',
    type: 'text',
    nullable: true,
  })
  phoneNumber!: string;

  @Column({
    name: 'phone_number_verified_at',
    type: 'timestamp',
    nullable: true,
  })
  phoneNumberVerifiedAt?: Date;
}
