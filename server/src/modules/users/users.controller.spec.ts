import { BadRequestException, NotFoundException } from '@nestjs/common';

import { UserRole } from '../../database/entities/user.entity';
import { UsersController } from './users.controller';

describe('UsersController.getAllUsers', () => {
  let controller: UsersController;
  let usersService: { getAllUsers: jest.Mock };

  beforeEach(() => {
    usersService = {
      getAllUsers: jest.fn().mockResolvedValue({
        users: [],
        total: 0,
        page: 1,
        totalPages: 0,
      }),
    };

    controller = new UsersController(usersService as any);
  });

  it('forwards the query filters and returns the paginated user payload', async () => {
    const filters = {
      role: UserRole.FREELANCER,
      search: 'member',
      isBanned: false,
      page: 2,
      limit: 10,
    };
    usersService.getAllUsers.mockResolvedValueOnce({
      users: [{ id: 'user-1', email: 'member@gmail.com' }],
      total: 1,
      page: 2,
      totalPages: 1,
    });

    const result = await controller.getAllUsers(filters as any);

    expect(usersService.getAllUsers).toHaveBeenCalledWith(filters);
    expect(result).toEqual({
      users: [{ id: 'user-1', email: 'member@gmail.com' }],
      total: 1,
      page: 2,
      totalPages: 1,
    });
  });
});

describe('UsersController.getUserDetail', () => {
  let controller: UsersController;
  let usersService: { getUserDetail: jest.Mock };

  beforeEach(() => {
    usersService = {
      getUserDetail: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'member@gmail.com',
      }),
    };

    controller = new UsersController(usersService as any);
  });

  it('forwards the user id and returns the detailed user payload', async () => {
    const result = await controller.getUserDetail('user-1');

    expect(usersService.getUserDetail).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      id: 'user-1',
      email: 'member@gmail.com',
    });
  });

  it('rethrows not-found errors from the service layer', async () => {
    usersService.getUserDetail.mockRejectedValueOnce(new NotFoundException('User not found'));

    await expect(controller.getUserDetail('missing-user')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('UsersController.banUser', () => {
  let controller: UsersController;
  let usersService: { banUser: jest.Mock };

  beforeEach(() => {
    usersService = {
      banUser: jest.fn().mockResolvedValue({
        message: 'User banned successfully',
      }),
    };

    controller = new UsersController(usersService as any);
  });

  it('forwards the user id, admin id, and reason payload to the service', async () => {
    const dto = { reason: 'Multiple violations' };

    const result = await controller.banUser('user-1', dto as any, 'admin-1');

    expect(usersService.banUser).toHaveBeenCalledWith('user-1', 'admin-1', dto);
    expect(result).toEqual({
      message: 'User banned successfully',
    });
  });

  it('rethrows bad-request errors when the user is already banned', async () => {
    usersService.banUser.mockRejectedValueOnce(new BadRequestException('User is already banned'));

    await expect(
      controller.banUser('user-1', { reason: 'Duplicate' } as any, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UsersController.unbanUser', () => {
  let controller: UsersController;
  let usersService: { unbanUser: jest.Mock };

  beforeEach(() => {
    usersService = {
      unbanUser: jest.fn().mockResolvedValue({
        message: 'User unbanned successfully',
      }),
    };

    controller = new UsersController(usersService as any);
  });

  it('forwards the user id, admin id, and reason payload to the service', async () => {
    const dto = { reason: 'Appeal approved' };

    const result = await controller.unbanUser('user-1', dto as any, 'admin-1');

    expect(usersService.unbanUser).toHaveBeenCalledWith('user-1', 'admin-1', dto);
    expect(result).toEqual({
      message: 'User unbanned successfully',
    });
  });

  it('rethrows bad-request errors when the user is not currently banned', async () => {
    usersService.unbanUser.mockRejectedValueOnce(new BadRequestException('User is not banned'));

    await expect(
      controller.unbanUser('user-1', { reason: 'Appeal approved' } as any, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
