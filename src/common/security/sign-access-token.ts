import { auth } from '../../auth/better-auth';

export async function signAccessToken(payload: Record<string, unknown>) {
  const sign = auth.api as unknown as {
    signJWT: (input: { body: { payload: Record<string, unknown> } }) => Promise<{
      token: string;
    }>;
  };
  return (await sign.signJWT({ body: { payload } })).token;
}
