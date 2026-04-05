import {
  CanActivate,
  ExecutionContext,
  Injectable,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { UserRole } from 'src/database/entities';
import { ROLES_KEY } from 'src/modules/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';

type QueryBuilderMock = {
  leftJoinAndSelect: jest.Mock;
  leftJoin: jest.Mock;
  innerJoinAndSelect: jest.Mock;
  select: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  orWhere: jest.Mock;
  orderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getManyAndCount: jest.Mock;
  getMany: jest.Mock;
  getOne: jest.Mock;
  getRawOne: jest.Mock;
};

const readHeader = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const CUSTOM_ROUTE_ARG_MARKER = '__customRouteArgs__';
const ROUTE_ARG_TYPE_REQ = '0';
const ROUTE_ARG_TYPE_RES = '1';
const ROUTE_ARG_TYPE_BODY = '3';
const ROUTE_ARG_TYPE_QUERY = '4';
const ROUTE_ARG_TYPE_PARAM = '5';
const ROUTE_ARG_TYPE_FILE = '8';

export const VALID_UUID = '11111111-1111-4111-8111-111111111111';
export const ALT_UUID = '22222222-2222-4222-8222-222222222222';
export const THIRD_UUID = '33333333-3333-4333-8333-333333333333';
export const VALID_ISO = '2026-04-01T09:00:00.000Z';
export const ALT_ISO = '2026-04-01T10:00:00.000Z';

type DynamicProxy = Record<string, any> & {
  __setDefaultImpl__(impl: (...args: any[]) => any): void;
  __getMock__(name: string): jest.Mock;
  __listMocks__(): Array<[string, jest.Mock]>;
};

export type RouteDescriptor = {
  controllerClass: any;
  controllerName: string;
  controllerPath: string;
  methodName: string;
  requestMethod: string;
  routePath: string;
  fullPath: string;
  roles: UserRole[];
};

const normalizePathSegment = (value: string | undefined) =>
  (value ?? '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/');

const joinPaths = (...parts: Array<string | undefined>) => {
  const normalized = parts
    .map((part) => normalizePathSegment(part))
    .filter((part) => part.length > 0);

  return `/${normalized.join('/')}`.replace(/\/+/g, '/');
};

const requestMethodName = (value: number | undefined) => {
  switch (value) {
    case 0:
      return 'GET';
    case 1:
      return 'POST';
    case 2:
      return 'PUT';
    case 3:
      return 'DELETE';
    case 4:
      return 'PATCH';
    case 5:
      return 'ALL';
    case 6:
      return 'OPTIONS';
    case 7:
      return 'HEAD';
    default:
      return 'GET';
  }
};

const readRouteArgsMetadata = (controllerClass: any, methodName: string) => {
  const proto = controllerClass.prototype;
  return (
    Reflect.getMetadata(ROUTE_ARGS_METADATA, proto.constructor, methodName) ??
    Reflect.getMetadata(ROUTE_ARGS_METADATA, proto[methodName]) ??
    {}
  );
};

export const createRepoMock = () => ({
  createQueryBuilder: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((input) => input),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
});

export const createQueryBuilderMock = (
  overrides: Partial<QueryBuilderMock> = {},
): QueryBuilderMock => {
  const chain: QueryBuilderMock = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getRawOne: jest.fn(),
  };

  return Object.assign(chain, overrides);
};

export const validateDto = <T extends object>(cls: new () => T, payload: unknown) =>
  validateSync(plainToInstance(cls, payload), {
    whitelist: false,
    forbidUnknownValues: false,
  });

export const createResponseMock = () => ({
  setHeader: jest.fn(),
  set: jest.fn(),
  send: jest.fn(),
  status: jest.fn().mockReturnThis(),
});

export const buildUser = (
  role: UserRole,
  overrides: Partial<{ id: string; fullName: string; email: string }> = {},
) => ({
  id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
  role,
  fullName: overrides.fullName ?? 'Bang Test',
  email: overrides.email ?? 'bang@example.com',
});

export const createServiceProxy = (
  defaultImpl: (...args: any[]) => any = async () => ({ ok: true }),
): DynamicProxy => {
  const mocks = new Map<string, jest.Mock>();
  let currentImpl = defaultImpl;

  const target: DynamicProxy = {
    __setDefaultImpl__(impl: (...args: any[]) => any) {
      currentImpl = impl;
      for (const mock of mocks.values()) {
        mock.mockImplementation((...args: any[]) => currentImpl(...args));
      }
    },
    __getMock__(name: string) {
      if (!mocks.has(name)) {
        mocks.set(name, jest.fn((...args: any[]) => currentImpl(...args)));
      }
      return mocks.get(name)!;
    },
    __listMocks__() {
      return Array.from(mocks.entries());
    },
  };

  return new Proxy(target, {
    get(proxyTarget, prop, receiver) {
      if (typeof prop !== 'string' || prop in proxyTarget) {
        return Reflect.get(proxyTarget, prop, receiver);
      }

      return proxyTarget.__getMock__(prop);
    },
  });
};

export const discoverControllerRoutes = (controllerClass: any): RouteDescriptor[] => {
  const controllerPath = normalizePathSegment(Reflect.getMetadata(PATH_METADATA, controllerClass));
  const classRoles = (Reflect.getMetadata(ROLES_KEY, controllerClass) as UserRole[] | undefined) ?? [];
  const proto = controllerClass.prototype;
  const descriptors: RouteDescriptor[] = [];

  for (const methodName of Object.getOwnPropertyNames(proto)) {
    if (methodName === 'constructor') {
      continue;
    }

    const requestMethod = Reflect.getMetadata(METHOD_METADATA, proto[methodName]);
    const routePath = Reflect.getMetadata(PATH_METADATA, proto[methodName]);
    if (requestMethod === undefined && routePath === undefined) {
      continue;
    }

    const methodRoles =
      (Reflect.getMetadata(ROLES_KEY, proto[methodName]) as UserRole[] | undefined) ?? classRoles;

    descriptors.push({
      controllerClass,
      controllerName: controllerClass.name,
      controllerPath,
      methodName,
      requestMethod: requestMethodName(requestMethod),
      routePath: normalizePathSegment(routePath),
      fullPath: joinPaths(controllerPath, routePath),
      roles: methodRoles,
    });
  }

  return descriptors;
};

export const findRouteDescriptor = (
  controllerClass: any,
  requestMethod: string,
  fullPath: string,
) => {
  const normalizedMethod = requestMethod.toUpperCase();
  const normalizedPath = joinPaths(fullPath);

  return discoverControllerRoutes(controllerClass).find(
    (route) =>
      route.requestMethod === normalizedMethod &&
      joinPaths(route.fullPath) === normalizedPath,
  );
};

export const getRouteGuards = (controllerClass: any, methodName: string) => {
  const proto = controllerClass.prototype;
  const classGuards = (Reflect.getMetadata(GUARDS_METADATA, controllerClass) as any[] | undefined) ?? [];
  const methodGuards =
    (Reflect.getMetadata(GUARDS_METADATA, proto[methodName]) as any[] | undefined) ?? [];
  return methodGuards.length > 0 ? methodGuards : classGuards;
};

const resolveRouteArgValue = ({
  argKey,
  config,
  req,
  res,
}: {
  argKey: string;
  config: {
    controllerClass: any;
    methodName: string;
    body?: Record<string, any>;
    query?: Record<string, any>;
    params?: Record<string, any>;
    user?: Record<string, any>;
    file?: Record<string, any>;
  };
  req: Record<string, any>;
  res: Record<string, any>;
}) => {
  const typePrefix = argKey.includes(CUSTOM_ROUTE_ARG_MARKER)
    ? CUSTOM_ROUTE_ARG_MARKER
    : argKey.split(':', 1)[0];
  const metaEntry = readRouteArgsMetadata(config.controllerClass, config.methodName)[argKey];
  const data = metaEntry?.data;

  if (typePrefix === ROUTE_ARG_TYPE_REQ) {
    return req;
  }
  if (typePrefix === ROUTE_ARG_TYPE_RES) {
    return res;
  }
  if (typePrefix === ROUTE_ARG_TYPE_BODY) {
    return data ? config.body?.[data] : config.body ?? {};
  }
  if (typePrefix === ROUTE_ARG_TYPE_QUERY) {
    return data ? config.query?.[data] : config.query ?? {};
  }
  if (typePrefix === ROUTE_ARG_TYPE_PARAM) {
    return data ? config.params?.[data] : config.params ?? {};
  }
  if (typePrefix === ROUTE_ARG_TYPE_FILE) {
    return config.file;
  }
  if (typePrefix === CUSTOM_ROUTE_ARG_MARKER) {
    return data ? config.user?.[data] : config.user;
  }

  return undefined;
};

export const invokeControllerMethod = async ({
  controllerClass,
  controller,
  methodName,
  body,
  query,
  params,
  user,
  file,
  reqExtras,
  res,
}: {
  controllerClass: any;
  controller: Record<string, any>;
  methodName: string;
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
  user?: Record<string, any>;
  file?: Record<string, any>;
  reqExtras?: Record<string, any>;
  res?: Record<string, any>;
}) => {
  const routeArgs = readRouteArgsMetadata(controllerClass, methodName);
  const request = {
    user,
    body: body ?? {},
    query: query ?? {},
    params: params ?? {},
    ...reqExtras,
  };
  const response = res ?? createResponseMock();
  const args: any[] = [];

  for (const argKey of Object.keys(routeArgs)) {
    const index = routeArgs[argKey]?.index;
    args[index] = resolveRouteArgValue({
      argKey,
      config: {
        controllerClass,
        methodName,
        body,
        query,
        params,
        user,
        file,
      },
      req: request,
      res: response,
    });
  }

  const result = await controller[methodName](...args);
  return { result, req: request, res: response };
};

export const createRouteTestApp = async ({
  controllers,
  providers,
  defaultRole = UserRole.ADMIN,
  defaultUserId = '11111111-1111-4111-8111-111111111111',
}: {
  controllers: any[];
  providers: any[];
  defaultRole?: UserRole;
  defaultUserId?: string;
}): Promise<INestApplication> => {
  const moduleBuilder = Test.createTestingModule({
    controllers,
    providers,
  });

  moduleBuilder.overrideGuard(JwtAuthGuard).useValue({
    canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest<{
        headers: Record<string, string | string[] | undefined>;
        user?: { id: string; role: UserRole };
      }>();
      const auth = readHeader(request.headers['x-test-auth']);

      if (!auth || auth === 'unauthorized') {
        throw new UnauthorizedException('Unauthorized');
      }

      request.user = {
        id: readHeader(request.headers['x-test-user-id']) ?? defaultUserId,
        role: (readHeader(request.headers['x-test-role']) as UserRole | undefined) ?? defaultRole,
      };

      return true;
    },
  } satisfies CanActivate);

  moduleBuilder.overrideGuard(RolesGuard).useValue({
    canActivate(context: ExecutionContext) {
      const handlerRoles = Reflect.getMetadata(ROLES_KEY, context.getHandler()) as UserRole[] | undefined;
      const classRoles = Reflect.getMetadata(ROLES_KEY, context.getClass()) as UserRole[] | undefined;
      const requiredRoles = handlerRoles?.length ? handlerRoles : classRoles;

      if (!requiredRoles || requiredRoles.length === 0) {
        return true;
      }

      const { user } = context.switchToHttp().getRequest<{ user?: { role?: UserRole } }>();
      return Boolean(user?.role && requiredRoles.includes(user.role));
    },
  } satisfies CanActivate);

  const moduleRef = await moduleBuilder.compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidUnknownValues: false,
    }),
  );
  await app.init();
  return app;
};
