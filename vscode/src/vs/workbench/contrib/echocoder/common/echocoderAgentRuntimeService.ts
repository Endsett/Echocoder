/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';

export const IEchocoderAgentRuntimeService = createDecorator<IEchocoderAgentRuntimeService>('IEchocoderAgentRuntimeService');

export type EchocoderRunMode = 'chat' | 'inlineEdit' | 'composer' | 'completion' | 'terminal';
export type EchocoderRunState = 'running' | 'success' | 'error' | 'cancelled' | 'timeout';
export type EchocoderEngineKind = 'cli' | 'sdk';

export interface IEchocoderToolPolicy {
	autoApproveReads: boolean;
	autoApproveWrites: boolean;
	allowNetworkTools: boolean;
	terminalAutoRun: boolean;
}

export interface IEchocoderRunRequest {
	mode: EchocoderRunMode;
	prompt: string;
	cwd: string;
	engine?: EchocoderEngineKind;
	binaryPath?: string;
	model?: string;
	apiKey?: string;
	apiBaseUrl?: string;
	additionalArgs?: string[];
	toolPolicy?: Partial<IEchocoderToolPolicy>;
}

export interface IEchocoderAgentRuntimePreflight {
	ok: boolean;
	engine: EchocoderEngineKind;
	binaryPath?: string;
	model?: string;
	issues: string[];
	warnings: string[];
}

export interface IEchocoderAgentEvent {
	runId: string;
	mode: EchocoderRunMode;
	timestamp: number;
	kind: 'text' | 'toolProgress' | 'toolDecision' | 'state' | 'error' | 'derivedFileChange';
	message?: string;
	state?: EchocoderRunState;
	toolName?: string;
	derived?: boolean;
}

export type EchocoderToolCategory = 'read' | 'write' | 'terminal' | 'network' | 'unknown';
export type EchocoderToolDecision = 'approved' | 'denied';

export interface IEchocoderToolCall {
	tool: string;
	input?: Record<string, unknown>;
	cwd?: string;
}

export interface IEchocoderToolDecisionResult {
	decision: EchocoderToolDecision;
	category: EchocoderToolCategory;
	reason: string;
}

export interface IEchocoderRunHandle {
	runId: string;
	mode: EchocoderRunMode;
	onEvent: Event<IEchocoderAgentEvent>;
	cancel: (reason?: string) => void;
}

export interface IEchocoderAdapterContext {
	onEvent: (event: IEchocoderAgentEvent) => void;
	onFinish: (state: EchocoderRunState, error?: string) => void;
	evaluateToolCall: (call: IEchocoderToolCall) => IEchocoderToolDecisionResult;
}

export interface IEchocoderEngineAdapter {
	readonly id: EchocoderEngineKind;
	start(runId: string, request: IEchocoderRunRequest, context: IEchocoderAdapterContext, token: CancellationToken): Promise<IDisposable>;
}

export interface IEchocoderAgentRuntimeService {
	readonly _serviceBrand: undefined;
	readonly onDidAnyRunEvent: Event<IEchocoderAgentEvent>;
	readonly onDidPolicyChange: Event<IEchocoderToolPolicy>;
	readonly isBusy: boolean;
	readonly healthy: boolean;
	startRun(request: IEchocoderRunRequest, token?: CancellationToken): Promise<IEchocoderRunHandle>;
	cancelRun(runId: string, reason?: string): void;
	cancelAllRuns(reason?: string): void;
	onEvent(runId: string): Event<IEchocoderAgentEvent>;
	validateEnvironment(): IEchocoderAgentRuntimePreflight;
	setPolicy(policy: Partial<IEchocoderToolPolicy>): IEchocoderToolPolicy;
	getPolicy(): IEchocoderToolPolicy;
	evaluateToolCall(runId: string, mode: EchocoderRunMode, call: IEchocoderToolCall): IEchocoderToolDecisionResult;
}
