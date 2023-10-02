import { jest } from '@jest/globals';
import { MockInstance } from 'jest-mock';
import { CommunicationsService } from '../../services';
import { authenticate } from '../../test-utils/authenticate';
import { userOne } from '../../test-utils/fixtures';
import { setupServer } from '../../test-utils/setup-server';

describe('POST /communications/support', () => {
  const getRequest = setupServer();
  let accessToken: string;
  let comsSpy: MockInstance<
    ({
      email,
      subject,
      body,
      replyTo,
    }: {
      email: string;
      subject: string;
      body: string;
      replyTo: string;
    }) => Promise<void>
  >;

  beforeAll(() => {
    comsSpy = jest.spyOn(CommunicationsService.prototype, 'sendEmail').mockResolvedValue();
  });

  beforeAll(async () => {
    accessToken = await authenticate(getRequest(), userOne);
  });

  it('returns 400 if no message is specified', async () => {
    const response = await getRequest()
      .post('/communications/support')
      .set({ Authorization: `Bearer ${accessToken}` });

    expect(response.status).toBe(400);
  });

  it('returns 401 if no message is specified', async () => {
    const response = await getRequest().post('/communications/support').send({
      message: 'I need help!',
    });

    expect(response.status).toBe(401);
  });

  it('can successfully send a message', async () => {
    const response = await getRequest()
      .post('/communications/support')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({
        message: 'I need help!',
      });

    expect(response.status).toBe(200);
    expect(comsSpy).toHaveBeenCalledWith({
      email: process.env.FROM_EMAIL,
      subject: `Support request from ${userOne.firstName} ${userOne.lastName}`,
      body: 'I need help!',
      replyTo: userOne.email,
    });
  });
});
