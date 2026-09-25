import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  currentUser() {
    return {
      user: null,
      authenticated: false
    };
  }
}
