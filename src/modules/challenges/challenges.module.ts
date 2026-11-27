import { Module } from '@nestjs/common';
import { CHALLENGE_HANDLERS } from './challenge.types';
import { ChallengeHandlerRegistry, InvitationChallengeHandler, MagicLinkChallengeHandler, MfaChallengeHandler } from './challenge-handler.registry';
import { ChallengeCatalogService, ChallengeLifecycleService } from './services';
import { ConfigService } from '@nestjs/config';

@Module({providers:[{provide:'CHALLENGE_SECRET_CHECK',inject:[ConfigService],useFactory:(config:ConfigService)=>config.getOrThrow<string>('CHALLENGE_PROOF_SECRET')},ChallengeCatalogService,ChallengeLifecycleService,ChallengeHandlerRegistry,InvitationChallengeHandler,MagicLinkChallengeHandler,MfaChallengeHandler,{provide:CHALLENGE_HANDLERS,useFactory:(...handlers)=>handlers,inject:[InvitationChallengeHandler,MagicLinkChallengeHandler,MfaChallengeHandler]}],exports:[ChallengeCatalogService,ChallengeLifecycleService,ChallengeHandlerRegistry]})
export class ChallengesModule {}
