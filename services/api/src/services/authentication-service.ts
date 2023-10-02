import { injectable } from 'tsyringe';
import { StatusCodes } from 'http-status-codes';
import { v4 as uuid } from 'uuid';
import { ServiceError } from '../errors/service-error';
import { ErrorNames } from '../constants';
import { RefreshToken, User } from '../entities';
import { UserService } from './user-service';
import { Security } from '../lib/security/security';
import { EnvironmentUtils, EnvironmentVariable } from '../utils/environment';
import { JwtPayload } from 'jsonwebtoken';

export type AccessTokenCookieSettings = {
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'lax';
  expires: Date;
  domain?: string;
};

export type AccessTokenResponse = {
  accessToken: string;
  expiresIn: number;
};

export type SessionResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

@injectable()
export class AuthenticationService {
  private REFRESH_TOKEN_EXPIRATION_DURATION = 60 * 60 * 24 * 365; // 1 year
  private ACCESS_TOKEN_EXPIRATION_DURATION = 60 * 15; // 15 minutes

  public constructor(
    private userService: UserService,
    private security: Security,
    private environment: EnvironmentUtils
  ) {}

  public async createNewSession(user: User): Promise<SessionResponse> {
    const sessionId = uuid();

    const { accessToken, expiresIn } = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user, sessionId);

    return { accessToken, refreshToken, expiresIn };
  }

  private generateAccessToken(user: User): AccessTokenResponse {
    const payload = { sub: user.id };

    const accessToken = this.security.createToken({ payload, expiresIn: this.ACCESS_TOKEN_EXPIRATION_DURATION });

    return { accessToken, expiresIn: this.ACCESS_TOKEN_EXPIRATION_DURATION };
  }

  public async generateRefreshToken(user: User, sessionId: string): Promise<string> {
    const token = this.security.createRefreshToken();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + this.REFRESH_TOKEN_EXPIRATION_DURATION); // 1 year

    await RefreshToken.query().insert({
      sessionId,
      subject: user.id,
      token,
      expiresAt,
    });

    return token;
  }

  public async refreshToken(token: string): Promise<AccessTokenResponse> {
    const res = await RefreshToken.query().findOne({ token });
    if (!res) {
      throw new ServiceError({
        name: ErrorNames.AUTHORIZATION_FAILED,
        message: 'Invalid or missing refresh token',
        statusCode: StatusCodes.UNAUTHORIZED,
        debug: 'The attached refresh token does not exist',
      });
    }

    if (res.expiresAt < new Date()) {
      throw new ServiceError({
        name: ErrorNames.AUTHORIZATION_FAILED,
        message: 'Expired refresh token',
        statusCode: StatusCodes.UNAUTHORIZED,
        debug: 'The attached refresh token is expired',
      });
    }

    const user = await this.userService.findById(res.subject);
    if (!user) {
      throw new ServiceError({
        name: ErrorNames.AUTHORIZATION_FAILED,
        message: 'User does not exist',
        statusCode: StatusCodes.UNAUTHORIZED,
        debug: 'The user specified in the refresh token does not exist',
      });
    }

    return this.generateAccessToken(user);
  }

  public async expireToken(token: string): Promise<void> {
    const res = await RefreshToken.query().findOne({ token });

    if (!res) {
      return;
    }

    await RefreshToken.query().where({ id: res.id }).update({ expiresAt: new Date() });
  }

  public getRefreshTokenCookieConfiguration(): AccessTokenCookieSettings {
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + this.REFRESH_TOKEN_EXPIRATION_DURATION);

    return {
      secure: this.environment.getOrFail(EnvironmentVariable.ENVIRONMENT) !== 'local',
      httpOnly: true,
      sameSite: 'lax',
      domain: this.environment.getOrFail(EnvironmentVariable.ENVIRONMENT) ? undefined : process.env.APP_DOMAIN,
      expires,
    };
  }

  public async verifyPassword(email: string, password: string): Promise<User> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new ServiceError({
        name: ErrorNames.AUTHENTICATION_FAILED,
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'incorrect username or password',
        debug: 'Could not find a user for the given username',
      });
    }

    if (!user.password) {
      throw new ServiceError({
        name: ErrorNames.AUTHENTICATION_FAILED,
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'incorrect username or password',
        debug: 'The user does not have a configured password',
      });
    }

    const match = this.security.verifyPassword(user.password, password);

    if (!match) {
      throw new ServiceError({
        name: ErrorNames.AUTHENTICATION_FAILED,
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'incorrect username or password',
        debug: 'The password was incorrect',
      });
    }

    return user;
  }

  public async generatePasswordResetToken(email: string): Promise<string> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new ServiceError({
        name: ErrorNames.USER_DOES_NOT_EXIST,
        message: 'The user does not exist',
        statusCode: StatusCodes.BAD_REQUEST,
        debug: 'Could not find a user when creating password reset token',
      });
    }
    if (!user.password) {
      throw new ServiceError({
        name: ErrorNames.MISSING_PROPERTY_ERROR,
        message: 'The user does not have a password',
        statusCode: StatusCodes.BAD_REQUEST,
        debug: 'The password property on the user was not set',
      });
    }

    return this.security.createToken({ payload: { sub: email }, expiresIn: 60 * 10, secret: user.password });
  }

  public async resetPassword(password: string, resetToken: string): Promise<void> {
    const { sub } = this.security.decodeToken(resetToken);

    if (!sub) {
      throw new ServiceError({
        name: ErrorNames.VALIDATION_ERROR,
        message: 'Invalid reset token',
        statusCode: StatusCodes.BAD_REQUEST,
        debug: 'The token did not include a subject',
      });
    }

    const user = await this.userService.findByEmail(sub);
    if (!user) {
      throw new ServiceError({
        name: ErrorNames.USER_DOES_NOT_EXIST,
        message: 'Invalid reset token',
        statusCode: StatusCodes.BAD_REQUEST,
        debug: 'A user with the supplied reset password token subject does not exist',
      });
    }
    if (!user.password) {
      throw new ServiceError({
        name: ErrorNames.MISSING_PROPERTY_ERROR,
        message: 'Invalid user',
        statusCode: StatusCodes.BAD_REQUEST,
        debug: 'The subject of the reset password request does not have a password to reset',
      });
    }

    try {
      this.security.verifyToken({ token: resetToken, secret: user.password });
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw new ServiceError({
          name: ErrorNames.AUTHORIZATION_FAILED,
          message: 'Your reset password link is either invalid or expired',
          statusCode: StatusCodes.UNAUTHORIZED,
          debug: err.message,
        });
      }
      throw err;
    }

    const hashedPassword = this.security.hashPassword(password);
    await this.userService.update(user.id, { password: hashedPassword });
  }

  public async markUserAsVerified(verifyToken: string): Promise<void> {
    let payload: JwtPayload;
    try {
      payload = this.security.verifyToken({ token: verifyToken });
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw new ServiceError({
          name: ErrorNames.AUTHORIZATION_FAILED,
          message: 'Your verify user link is either invalid or expired',
          statusCode: StatusCodes.UNAUTHORIZED,
          debug: err.message,
        });
      }
      throw err;
    }

    if (!payload.sub) {
      throw new ServiceError({
        name: ErrorNames.AUTHORIZATION_FAILED,
        message: 'Your verify user link is either invalid or expired',
        statusCode: StatusCodes.UNAUTHORIZED,
        debug: 'The verify token was missing a subject claim',
      });
    }

    const user = await this.userService.findByEmail(payload.sub);
    if (!user) {
      throw new ServiceError({
        name: ErrorNames.USER_DOES_NOT_EXIST,
        message: 'Your verify user link is either invalid or expired',
        statusCode: StatusCodes.UNAUTHORIZED,
        debug: 'Could not find the corresponding user defined in the verify account token',
      });
    }

    if (!user.verifiedAt) {
      await this.userService.update(user.id, { verifiedAt: new Date() });
    }
  }
}
