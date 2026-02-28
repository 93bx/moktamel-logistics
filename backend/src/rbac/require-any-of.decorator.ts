import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ANY_OF_KEY = 'require_any_of';
export const RequireAnyOf = (...permissions: string[]) =>
  SetMetadata(REQUIRE_ANY_OF_KEY, permissions);
