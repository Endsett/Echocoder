/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableMap, DisposableStore, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IEchocoderCliRunEvent, IEchocoderCliService } from '../../../../platform/echocoder/common/echocoderCliService.js';
import {
	EchocoderEngineKind,
	EchocoderRunMode,
	EchocoderRunState,
	IEchocoderAdapterContext,
	IEchocoderAgentEvent,
	IEchocoderAgentRuntimePreflight,
	IEchocoderAgentRuntimeService,
	IEchocoderEngineAdapter,
	IEchocoderRunHandle,
	IEchocoderRunRequest,
	IEchocoderToolCall,
	IEchocoderToolDecisionResult,
	IEchocoderToolPolicy,
} from '../common/echocoderAgentRuntimeService.js';

interface IActiveRun {
	runId: string;
	mode: EchocoderRunMode;
	disposable: IDisposable;
	cancelSource: CancellationTokenSource;
}

const DEFAULT_POLICY: IEchocoderToolPolicy = {
	autoApproveReads: true,
	autoApproveWrites: false,
	allowNetworkTools: false,
	terminalAutoRun: false,
};

const READ_TOOLS = new Set(['read', 'ls', 'glob', 'grep', 'search', 'read_file', 'list_files', 'list_directory', 'file_search']);
const WRITE_TOOLS = new Set(['write', 'edit', 'write_file', 'edit_file', 'create_file', 'delete_file', 'rename_file', 'move_file', 'patch_file']);
const TERMINAL_TOOLS = new Set(['bash', 'powershell', 'run_bash', 'execute_command', 'shell', 'terminal', 'run_command']);
const NETWORK_TOOLS = new Set(['fetch', 'curl', 'http_request', 'web_request', 'webfetch', 'web_search', 'websearch']);
const SENSITIVE_PATH_PATTERN = /(^|[\\/])(\.env($|[.\-])|secrets([\\/]|$)|\.ssh([\\/]|$)|credentials|password|token|.*\.(pem|key)$)/i;

class OpenClaudeCliAdapter implements IEchocoderEngineAdapter {
	readonly id: EchocoderEngineKind = 'cli';

	constructor(
		private readonly cliService: IEchocoderCliService,
	) { }

	async start(runId: string, request: IEchocoderRunRequest, context: IEchocoderAdapterContext, token: CancellationToken): Promise<IDisposable> {
		if (token.isCancellationRequested) {
			context.onFinish('cancelled', 'Run cancelled before startup.');
			return Disposable.None;
		}

		const runDisposables = new DisposableStore();
		let ndjsonBuffer = '';
		let finished = false;

		const finishOnce = (state: EchocoderRunState, error?: string) => {
			if (finished) {
				return;
			}
			finished = true;
			context.onFinish(state, error);
		};

		const publishWarning = (message: string) => {
			context.onEvent({
				runId,
				mode: request.mode,
				timestamp: Date.now(),
				kind: 'toolProgress',
				message: `[warn] ${message}`,
			});
		};

		const parseLine = (line: string) => {
			if (!line.trim()) {
				return;
			}

			let event: Record<string, unknown>;
			try {
				event = JSON.parse(line) as Record<string, unknown>;
			} catch (error) {
				publishWarning(`NDJSON parse warning: ${error instanceof Error ? error.message : String(error)}`);
				return;
			}

			const type = typeof event.type === 'string' ? event.type : undefined;
			const subtype = typeof event.subtype === 'string' ? event.subtype : undefined;

			if (type === 'assistant' && subtype === 'text_delta') {
				context.onEvent({
					runId,
					mode: request.mode,
					timestamp: Date.now(),
					kind: 'text',
					message: typeof event.text === 'string' ? event.text : '',
				});
				return;
			}

			if (type === 'assistant' && subtype === 'thinking_delta') {
				context.onEvent({
					runId,
					mode: request.mode,
					timestamp: Date.now(),
					kind: 'toolProgress',
					message: `[thinking] ${typeof event.text === 'string' ? event.text : ''}`,
				});
				return;
			}

			if (type === 'assistant' && subtype === 'tool_call') {
				const tool = typeof event.tool === 'string' ? event.tool : 'unknown';
				const input = (event.input && typeof event.input === 'object') ? event.input as Record<string, unknown> : undefined;
				const decision = context.evaluateToolCall({ tool, input, cwd: request.cwd });
				context.onEvent({
					runId,
					mode: request.mode,
					timestamp: Date.now(),
					kind: 'toolDecision',
					toolName: tool,
					message: `[policy] ${decision.category} -> ${decision.decision} (${decision.reason})`,
				});
				context.onEvent({
					runId,
					mode: request.mode,
					timestamp: Date.now(),
					kind: 'toolProgress',
					toolName: tool,
					message: `[tool] ${tool} requested`,
				});
				return;
			}

			if (type === 'assistant' && subtype === 'tool_result') {
				context.onEvent({
					runId,
					mode: request.mode,
					timestamp: Date.now(),
					kind: 'toolProgress',
					message: '[tool] result received',
				});
				return;
			}

			if (type === 'assistant' && (subtype === 'file_edit' || subtype === 'file_create')) {
				const path = typeof event.path === 'string' ? event.path : '<unknown>';
				context.onEvent({
					runId,
					mode: request.mode,
					timestamp: Date.now(),
					kind: 'derivedFileChange',
					derived: true,
					message: `[derived] ${subtype} ${path}`,
				});
				return;
			}

			if (type === 'result' && subtype === 'success') {
				const content = typeof event.content === 'string' ? event.content : '';
				if (content) {
					context.onEvent({
						runId,
						mode: request.mode,
						timestamp: Date.now(),
						kind: 'text',
						message: content,
					});
				}
				finishOnce('success');
				return;
			}

			if (type === 'result' && subtype === 'error') {
				const error = typeof event.error === 'string' ? event.error : 'Unknown agent error';
				finishOnce('error', error);
				return;
			}

			if (type === 'system') {
				context.onEvent({
					runId,
					mode: request.mode,
					timestamp: Date.now(),
					kind: 'toolProgress',
					message: `[system] ${subtype ?? 'event'}`,
				});
				return;
			}

			context.onEvent({
				runId,
				mode: request.mode,
				timestamp: Date.now(),
				kind: 'toolProgress',
				message: '[stream] unhandled event ignored',
			});
		};

		const parseChunk = (chunk: string) => {
			ndjsonBuffer += chunk;
			let newlineIndex = ndjsonBuffer.indexOf('\n');
			while (newlineIndex >= 0) {
				const line = ndjsonBuffer.slice(0, newlineIndex);
				ndjsonBuffer = ndjsonBuffer.slice(newlineIndex + 1);
				parseLine(line.trim());
				newlineIndex = ndjsonBuffer.indexOf('\n');
			}
		};

		runDisposables.add(this.cliService.onDidRunEvent((event: IEchocoderCliRunEvent) => {
			if (event.runId !== runId || finished) {
				return;
			}

			if (event.kind === 'stdout' && typeof event.data === 'string') {
				parseChunk(event.data);
				return;
			}

			if (event.kind === 'stderr') {
				context.onEvent({
					runId,
					mode: request.mode,
					timestamp: event.timestamp,
					kind: 'error',
					message: `[stderr] ${event.data ?? ''}`.trim(),
				});
				return;
			}

			if (event.kind === 'error') {
				finishOnce('error', event.data ?? 'CLI process error');
				return;
			}

			if (event.kind === 'exit') {
				if (ndjsonBuffer.trim()) {
					parseLine(ndjsonBuffer.trim());
					ndjsonBuffer = '';
				}
				if (!finished) {
					if (event.code === 0) {
						finishOnce('success');
					} else {
						finishOnce('error', `CLI exited with code ${event.code ?? 'unknown'}${event.signal ? ` (${event.signal})` : ''}`);
					}
				}
			}
		}));

		runDisposables.add(toDisposable(() => {
			void this.cliService.cancelRun(runId);
		}));

		runDisposables.add(token.onCancellationRequested(() => {
			void this.cliService.cancelRun(runId);
			finishOnce('cancelled', 'Run cancelled by user');
		}));

		await this.cliService.startRun({
			runId,
			binaryPath: request.binaryPath ?? 'claude',
			cwd: request.cwd,
			prompt: request.prompt,
			model: request.model,
			apiKey: request.apiKey,
			apiBaseUrl: request.apiBaseUrl,
			additionalArgs: request.additionalArgs,
		});

		context.onEvent({
			runId,
			mode: request.mode,
			timestamp: Date.now(),
			kind: 'toolProgress',
			message: '[agent] CLI run started',
		});

		return runDisposables;
	}
}

class OpenClaudeSdkAdapter implements IEchocoderEngineAdapter {
	readonly id: EchocoderEngineKind = 'sdk';

	async start(runId: string, request: IEchocoderRunRequest, context: IEchocoderAdapterContext): Promise<IDisposable> {
		context.onEvent({
			runId,
			mode: request.mode,
			timestamp: Date.now(),
			kind: 'toolProgress',
			message: '[agent] SDK adapter selected',
		});
		throw new Error('OpenClaude SDK adapter is not implemented yet.');
	}
}

export class EchocoderAgentRuntimeService extends Disposable implements IEchocoderAgentRuntimeService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidAnyRunEvent = this._register(new Emitter<IEchocoderAgentEvent>());
	readonly onDidAnyRunEvent = this._onDidAnyRunEvent.event;

	private readonly _onDidPolicyChange = this._register(new Emitter<IEchocoderToolPolicy>());
	readonly onDidPolicyChange = this._onDidPolicyChange.event;

	private readonly _runEventEmitters = this._register(new DisposableMap<string, Emitter<IEchocoderAgentEvent>>());
	private readonly _activeRuns = new Map<string, IActiveRun>();
	private readonly _adapters = new Map<EchocoderEngineKind, IEchocoderEngineAdapter>();

	private _policy: IEchocoderToolPolicy;
	private _primaryActiveRunId: string | undefined;
	private _healthy = true;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ILogService private readonly logService: ILogService,
		@IEchocoderCliService private readonly cliService: IEchocoderCliService,
	) {
		super();

		this._policy = this.readPolicyFromConfig();
		this._adapters.set('cli', new OpenClaudeCliAdapter(this.cliService));
		this._adapters.set('sdk', new OpenClaudeSdkAdapter());

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (
				e.affectsConfiguration('echocoder.autoApproveReads') ||
				e.affectsConfiguration('echocoder.autoApproveWrites') ||
				e.affectsConfiguration('echocoder.allowNetworkTools') ||
				e.affectsConfiguration('echocoder.terminalAutoRun')
			) {
				this._policy = this.readPolicyFromConfig();
				this._onDidPolicyChange.fire(this._policy);
			}
		}));
	}

	get isBusy(): boolean {
		return this._activeRuns.size > 0;
	}

	get healthy(): boolean {
		return this._healthy;
	}

	async startRun(request: IEchocoderRunRequest, token: CancellationToken = CancellationToken.None): Promise<IEchocoderRunHandle> {
		if (!request.prompt?.trim()) {
			throw new Error('EchoCoder runtime requires a non-empty prompt.');
		}

		const preflight = this.validateEnvironment();
		if (!preflight.ok) {
			throw new Error(`EchoCoder preflight failed: ${preflight.issues.join(' | ')}`);
		}

		if ((request.mode === 'completion' || request.mode === 'terminal') && this._primaryActiveRunId) {
			throw new Error(`Cannot start ${request.mode} run while another primary run is active.`);
		}

		const runId = generateUuid();
		const engine = request.engine || preflight.engine;
		const effectiveRequest: IEchocoderRunRequest = {
			...request,
			engine,
			binaryPath: request.binaryPath ?? preflight.binaryPath,
			model: request.model ?? preflight.model,
			apiKey: request.apiKey ?? this.configurationService.getValue<string>('echocoder.apiKey'),
			apiBaseUrl: request.apiBaseUrl ?? this.configurationService.getValue<string>('echocoder.apiBaseUrl'),
		};
		const adapter = this._adapters.get(engine);
		if (!adapter) {
			throw new Error(`Unknown EchoCoder engine adapter: ${engine}`);
		}

		const runEmitter = this._register(new Emitter<IEchocoderAgentEvent>());
		this._runEventEmitters.set(runId, runEmitter);
		const cancelSource = new CancellationTokenSource(token);
		this._activeRuns.set(runId, {
			runId,
			mode: request.mode,
			disposable: Disposable.None,
			cancelSource,
		});

		if (request.mode !== 'completion') {
			this._primaryActiveRunId = runId;
		}

		const publish = (event: IEchocoderAgentEvent) => {
			runEmitter.fire(event);
			this._onDidAnyRunEvent.fire(event);
			this.logService.info(`[EchoCoder][${event.kind}] run=${event.runId} mode=${event.mode} msg=${event.message ?? ''}`);
		};

		publish({
			runId,
			mode: request.mode,
			timestamp: Date.now(),
			kind: 'state',
			state: 'running',
			message: `[session] started via ${engine}`,
		});

		const context: IEchocoderAdapterContext = {
			onEvent: publish,
			evaluateToolCall: call => this.evaluateToolCall(runId, request.mode, call),
			onFinish: (state, error) => {
				if (error) {
					publish({
						runId,
						mode: request.mode,
						timestamp: Date.now(),
						kind: 'error',
						message: error,
					});
				}
				publish({
					runId,
					mode: request.mode,
					timestamp: Date.now(),
					kind: 'state',
					state,
					message: `[session] ended`,
				});
				this.finishRun(runId);
			},
		};

		try {
			const disposable = await adapter.start(runId, effectiveRequest, context, cancelSource.token);
			const active = this._activeRuns.get(runId);
			if (!active) {
				disposable.dispose();
			} else {
				active.disposable = disposable;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			publish({
				runId,
				mode: request.mode,
				timestamp: Date.now(),
				kind: 'error',
				message,
			});
			publish({
				runId,
				mode: request.mode,
				timestamp: Date.now(),
				kind: 'state',
				state: 'error',
				message: '[session] ended',
			});
			this.finishRun(runId);
			throw error;
		}

		return {
			runId,
			mode: request.mode,
			onEvent: runEmitter.event,
			cancel: reason => this.cancelRun(runId, reason),
		};
	}

	cancelRun(runId: string, reason = 'cancelled by user'): void {
		const active = this._activeRuns.get(runId);
		if (!active) {
			return;
		}

		active.cancelSource.cancel();
		this._onDidAnyRunEvent.fire({
			runId,
			mode: active.mode,
			timestamp: Date.now(),
			kind: 'state',
			state: 'cancelled',
			message: `[session] ${reason}`,
		});
		this.finishRun(runId);
	}

	cancelAllRuns(reason = 'cancelled by user'): void {
		for (const runId of Array.from(this._activeRuns.keys())) {
			this.cancelRun(runId, reason);
		}
	}

	onEvent(runId: string): Event<IEchocoderAgentEvent> {
		const emitter = this._runEventEmitters.get(runId);
		return emitter ? emitter.event : Event.None;
	}

	validateEnvironment(): IEchocoderAgentRuntimePreflight {
		const cfg = this.configurationService.getValue<{
			enabled?: boolean;
			engine?: EchocoderEngineKind;
			binaryPath?: string;
			model?: string;
			apiKey?: string;
			apiBaseUrl?: string;
		}>('echocoder') || {};

		const issues: string[] = [];
		const warnings: string[] = [];
		const engine = cfg.engine || 'cli';

		if (cfg.enabled === false) {
			issues.push('EchoCoder is disabled. Enable "echocoder.enabled" to run the first-party agent.');
		}

		if (engine === 'cli' && !cfg.binaryPath) {
			issues.push('echocoder.binaryPath is not configured. Set it to the OpenClaude CLI executable path.');
		}

		if (!cfg.model) {
			warnings.push('echocoder.model is not configured.');
		}

		if (!cfg.apiKey) {
			warnings.push('echocoder.apiKey is not configured.');
		}

		return {
			ok: issues.length === 0,
			engine,
			binaryPath: cfg.binaryPath,
			model: cfg.model,
			issues,
			warnings,
		};
	}

	setPolicy(policy: Partial<IEchocoderToolPolicy>): IEchocoderToolPolicy {
		this._policy = { ...this._policy, ...policy };
		this._onDidPolicyChange.fire(this._policy);
		return this._policy;
	}

	getPolicy(): IEchocoderToolPolicy {
		return this._policy;
	}

	evaluateToolCall(runId: string, mode: EchocoderRunMode, call: IEchocoderToolCall): IEchocoderToolDecisionResult {
		const tool = call.tool.toLowerCase();
		const category = READ_TOOLS.has(tool)
			? 'read'
			: WRITE_TOOLS.has(tool)
				? 'write'
				: TERMINAL_TOOLS.has(tool)
					? 'terminal'
					: NETWORK_TOOLS.has(tool)
						? 'network'
						: 'unknown';

		const input = call.input ?? {};
		const pathValue = typeof input.path === 'string'
			? input.path
			: typeof input.file_path === 'string'
				? input.file_path
				: typeof input.filename === 'string'
					? input.filename
					: undefined;

		let result: IEchocoderToolDecisionResult;
		if (category === 'read') {
			result = this._policy.autoApproveReads
				? { decision: 'approved', category, reason: 'read auto-approved by policy' }
				: { decision: 'denied', category, reason: 'read tool requires manual approval' };
		} else if (category === 'write') {
			if (pathValue && SENSITIVE_PATH_PATTERN.test(pathValue)) {
				result = { decision: 'denied', category, reason: 'write blocked for sensitive path' };
			} else if (this._policy.autoApproveWrites) {
				result = { decision: 'approved', category, reason: 'write auto-approved by policy' };
			} else {
				result = { decision: 'denied', category, reason: 'write requires manual approval' };
			}
		} else if (category === 'terminal') {
			result = this._policy.terminalAutoRun
				? { decision: 'approved', category, reason: 'terminal auto-approved by policy' }
				: { decision: 'denied', category, reason: 'terminal requires manual approval' };
		} else if (category === 'network') {
			result = this._policy.allowNetworkTools
				? { decision: 'approved', category, reason: 'network enabled by policy' }
				: { decision: 'denied', category, reason: 'network disabled by policy' };
		} else {
			result = { decision: 'denied', category, reason: 'unknown tool category requires manual approval' };
		}

		this._onDidAnyRunEvent.fire({
			runId,
			mode,
			timestamp: Date.now(),
			kind: 'toolDecision',
			toolName: call.tool,
			message: `[policy] ${result.category} -> ${result.decision} (${result.reason})`,
		});

		return result;
	}

	override dispose(): void {
		for (const runId of Array.from(this._activeRuns.keys())) {
			this.cancelRun(runId, 'runtime disposed');
		}
		super.dispose();
	}

	private finishRun(runId: string): void {
		const active = this._activeRuns.get(runId);
		if (!active) {
			return;
		}

		active.disposable.dispose();
		active.cancelSource.dispose(true);
		this._activeRuns.delete(runId);

		if (this._primaryActiveRunId === runId) {
			this._primaryActiveRunId = undefined;
		}

		const emitter = this._runEventEmitters.get(runId);
		if (emitter) {
			emitter.dispose();
			this._runEventEmitters.deleteAndDispose(runId);
		}
	}

	private readPolicyFromConfig(): IEchocoderToolPolicy {
		return {
			autoApproveReads: this.configurationService.getValue<boolean>('echocoder.autoApproveReads') ?? DEFAULT_POLICY.autoApproveReads,
			autoApproveWrites: this.configurationService.getValue<boolean>('echocoder.autoApproveWrites') ?? DEFAULT_POLICY.autoApproveWrites,
			allowNetworkTools: this.configurationService.getValue<boolean>('echocoder.allowNetworkTools') ?? DEFAULT_POLICY.allowNetworkTools,
			terminalAutoRun: this.configurationService.getValue<boolean>('echocoder.terminalAutoRun') ?? DEFAULT_POLICY.terminalAutoRun,
		};
	}
}
