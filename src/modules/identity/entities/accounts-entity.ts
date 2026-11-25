import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base-entity';

@Entity('accounts')
export class Accounts extends BaseEntity {
  @Column({
    name: 'provide_id',
    type: 'text',
    nullable: false,
  })
  provideId!: string;

  @Column({
    name: 'account_id',
    type: 'text',
    nullable: false,
  })
  accountId!: string;

  @Column({
    name: 'password',
    type: 'text',
  })
    password!: string;
    
}
