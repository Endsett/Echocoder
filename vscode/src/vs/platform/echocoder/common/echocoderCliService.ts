/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export const IEchocoderCliService = createDecorator<IEchocoderCliService>('echocoderCliService');

export type EchocoderCliEventKind = 'start' | 'stdout' | 'stderr' | 'exit' | 'error';

export interface IEchocoderCliRunRequest {
	runId: string;
	binaryPath: string;
	cwd: string;
	prompt: string;
	model?: string;
	apiKey?: string;
	apiBaseUrl?: string;
	additionalArgs?: string[];
}

export interface IEchocoderCliRunEvent {
	runId: string;
	kind: EchocoderCliEventKind;
	timestamp: number;
	data?: string;
	code?: number | null;
	signal?: string | null;
}

export interface IEchocoderCliService {
	readonly _serviceBrand: undefined;
	readonly onDidRunEvent: Event<IEchocoderCliRunEvent>;
	startRun(request: IEchocoderCliRunRequest): Promise<void>;
	cancelRun(runId: string): Promise<void>;
	hasActiveRun(runId: string): Promise<boolean>;
}

