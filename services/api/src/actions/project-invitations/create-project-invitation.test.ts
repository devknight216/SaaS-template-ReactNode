import { setupServer } from '../../test-utils';
import { authenticate } from '../../test-utils/authenticate';
import { userOne } from '../../test-utils/fixtures';

describe('POST /project-invitations', () => {
  const getRequest = setupServer();
  let accessToken: string;
  let createdProject: Record<string, unknown>;

  beforeAll(async () => {
    accessToken = await authenticate(getRequest(), userOne);
    const response = await getRequest()
      .post('/projects')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({
        name: 'My new project!',
      });

    expect(response.status).toBe(200);

    createdProject = response.body.project;
  });

  it('can create a new project invitation', async () => {
    const resp = await getRequest()
      .post('/project-invitations')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({
        to_user_email: 'stephen@hawking.com',
        project_id: createdProject.id,
      });

    expect(resp.status).toBe(200);
  });

  it('returns 400 if no user email is specified', async () => {
    const resp = await getRequest()
      .post('/project-invitations')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({
        project_id: createdProject.id,
      });

    expect(resp.status).toBe(400);
  });

  it('returns 400 if no project id is specified', async () => {
    const resp = await getRequest()
      .post('/project-invitations')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({
        to_user_email: 'john.doe@volca.io',
      });

    expect(resp.status).toBe(400);
  });

  it('returns 401 if user is not authenticated', async () => {
    const resp = await getRequest()
      .post('/project-invitations')
      .send({
        to_user_email: 'john.doe@volca.io',
        project_id: createdProject.id,
      });

    expect(resp.status).toBe(401);
  });
});
