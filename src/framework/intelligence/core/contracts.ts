/** Vendor-neutral contracts. Author: Raushan Raj */
import type { ExecutionPublishRequest, PublishResult, RequirementDocument } from './models.js';
export interface RequirementSourceAdapter { getRequirement(id:string):Promise<RequirementDocument>; searchRequirements?(query:string):Promise<RequirementDocument[]>; }
export interface ExecutionStatusPublisher { publish(result:ExecutionPublishRequest):Promise<PublishResult>; }
