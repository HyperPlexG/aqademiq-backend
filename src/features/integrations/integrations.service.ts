import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';

/** §2.12 — business logic. Scaffolded: signatures present, bodies are TODOs. */
@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** TODO §2.12: ICS subscription import */
  importIcs() { throw new Error('Not implemented: integrations.importIcs (§2.12)'); }

  /** TODO §2.12: Google Calendar import (Apple=on-device) */
  googleOauth() { throw new Error('Not implemented: integrations.googleOauth (§2.12)'); }
}
