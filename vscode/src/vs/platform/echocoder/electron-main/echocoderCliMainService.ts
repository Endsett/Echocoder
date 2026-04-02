/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChildProcess, spawn } from 'child_process';
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { basename } from '../../../base/common/path.js';
import { ILogService } from '../../log/common/log.js';
import { IEchocoderCliRunRequest, IEchocoderCliRunEvent, IEchocoderCliService } from '../common/echocoderCliService.js';

interface IActiveRun {
	readonly process: ChildProcess;
}

export class EchocoderCliMainService extends Disposable implements IEchocoderCliService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidRunEvent = this._register(new Emitter<IEchocoderCliRunEvent>());
	readonly onDidRunEvent = this._onDidRunEvent.event;

	private readonly activeRuns = new Map<string, IActiveRun>();

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	async startRun(request: IEchocoderCliRunRequest): Promise<void> {
		if (this.activeRuns.has(request.runId)) {
			await this.cancelRun(request.runId);
		}

		const args: string[] = [
			'-p',
			'--output-format', 'stream-json',
			'--verbose',
			'--cwd', request.cwd,
		];
		if (request.additionalArgs?.length) {
			args.push(...request.additionalArgs);
		}
		args.push(request.prompt);

		const env: NodeJS.ProcessEnv = {
			...process.env,
			TERM: 'dumb',
			NO_COLOR: '1',
		};
		if (request.model) {
			env.OPENAI_MODEL = request.model;
			env.ANTHROPIC_MODEL = request.model;
		}
		if (request.apiKey) {
			env.OPENAI_API_KEY = request.apiKey;
			env.ANTHROPIC_API_KEY = request.apiKey;
		}
		if (request.apiBaseUrl) {
			env.OPENAI_BASE_URL = request.apiBaseUrl;
		}

		const child = spawn(request.binaryPath, args, {
			cwd: request.cwd,
			env,
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
		});

		this.logService.info(`[EchoCoder][cli] spawn ${basename(request.binaryPath)} run=${request.runId}`);
		this.activeRuns.set(request.runId, { process: child });

		this._onDidRunEvent.fire({
			runId: request.runId,
			kind: 'start',
			timestamp: Date.now(),
			data: `${request.binaryPath} ${args.join(' ')}`,
		});

		child.stdout?.setEncoding('utf8');
		child.stdout?.on('data', (chunk: string | Buffer) => {
			this._onDidRunEvent.fire({
				runId: request.runId,
				kind: 'stdout',
				timestamp: Date.now(),
				data: typeof chunk === 'string' ? chunk : chunk.toString('utf8'),
			});
		});

		child.stderr?.setEncoding('utf8');
		child.stderr?.on('data', (chunk: string | Buffer) => {
			this._onDidRunEvent.fire({
				runId: request.runId,
				kind: 'stderr',
				timestamp: Date.now(),
				data: typeof chunk === 'string' ? chunk : chunk.toString('utf8'),
			});
		});

		child.on('error', error => {
			this._onDidRunEvent.fire({
				runId: request.runId,
				kind: 'error',
				timestamp: Date.now(),
				data: error.message,
			});
			this.cleanupRun(request.runId);
		});

		child.on('exit', (code, signal) => {
			this._onDidRunEvent.fire({
				runId: request.runId,
				kind: 'exit',
				timestamp: Date.now(),
				code,
				signal,
			});
			this.cleanupRun(request.runId);
		});
	}

	async cancelRun(runId: string): Promise<void> {
		const run = this.activeRuns.get(runId);
		if (!run) {
			return;
		}

		run.process.kill('SIGTERM');
		setTimeout(() => {
			const stillRunning = this.activeRuns.get(runId);
			if (stillRunning) {
				stillRunning.process.kill('SIGKILL');
				this.cleanupRun(runId);
			}
		}, 3000);
	}

	async hasActiveRun(runId: string): Promise<boolean> {
		return this.activeRuns.has(runId);
	}

	override dispose(): void {
		for (const runId of Array.from(this.activeRuns.keys())) {
			void this.cancelRun(runId);
		}
		super.dispose();
	}

	private cleanupRun(runId: string): void {
		this.activeRuns.delete(runId);
	}
}

