/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IEchocoderAgentRuntimeService } from '../common/echocoderAgentRuntimeService.js';
import { EchocoderAgentRuntimeService } from './echocoderRuntimeService.js';

registerSingleton(IEchocoderAgentRuntimeService, EchocoderAgentRuntimeService, InstantiationType.Eager);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'echocoder',
	title: localize('echocoder.configuration.title', 'EchoCoder'),
	type: 'object',
	properties: {
		'echocoder.enabled': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: localize('echocoder.enabled', 'Enable EchoCoder as the first-party AI-native runtime in this IDE fork.'),
		},
		'echocoder.engine': {
			type: 'string',
			enum: ['cli', 'sdk'],
			default: 'cli',
			scope: ConfigurationScope.APPLICATION,
			description: localize('echocoder.engine', 'Selects the runtime engine adapter used by first-party EchoCoder surfaces.'),
		},
		'echocoder.binaryPath': {
			type: 'string',
			default: '',
			scope: ConfigurationScope.APPLICATION,
			description: localize('echocoder.binaryPath', 'Absolute path to the OpenClaude CLI binary.'),
		},
		'echocoder.model': {
			type: 'string',
			default: '',
			scope: ConfigurationScope.APPLICATION,
			description: localize('echocoder.model', 'Default model identifier used by the EchoCoder runtime.'),
		},
		'echocoder.apiKey': {
			type: 'string',
			default: '',
			scope: ConfigurationScope.APPLICATION,
			description: localize('echocoder.apiKey', 'API key used by provider integrations in EchoCoder runtime adapters.'),
		},
		'echocoder.apiBaseUrl': {
			type: 'string',
			default: '',
			scope: ConfigurationScope.APPLICATION,
			description: localize('echocoder.apiBaseUrl', 'Optional API base URL used by OpenAI-compatible providers.'),
		},
		'echocoder.autoApproveReads': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: localize('echocoder.autoApproveReads', 'Auto-approve read-only tools.'),
		},
		'echocoder.autoApproveWrites': {
			type: 'boolean',
			default: false,
			scope: ConfigurationScope.APPLICATION,
			description: localize('echocoder.autoApproveWrites', 'Auto-approve write tools (sensitive and out-of-workspace writes remain blocked).'),
		},
		'echocoder.allowNetworkTools': {
			type: 'boolean',
			default: false,
			scope: ConfigurationScope.APPLICATION,
			description: localize('echocoder.allowNetworkTools', 'Allow network tools in EchoCoder runtime policy.'),
		},
		'echocoder.terminalAutoRun': {
			type: 'boolean',
			default: false,
			scope: ConfigurationScope.APPLICATION,
			description: localize('echocoder.terminalAutoRun', 'Allow terminal tools without manual approval.'),
		},
		'echocoder.compat.enableCopilotFallback': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: localize('echocoder.compat.enableCopilotFallback', 'Allow Copilot/GitHub fallback compatibility when EchoCoder cannot serve a request.'),
		},
	},
});

class EchocoderRuntimePreflightContribution {
	static readonly ID = 'workbench.contrib.echocoderRuntimePreflight';

	constructor(
		@IEchocoderAgentRuntimeService runtimeService: IEchocoderAgentRuntimeService,
		@INotificationService notificationService: INotificationService,
	) {
		const preflight = runtimeService.validateEnvironment();
		if (!preflight.ok) {
			notificationService.warn(localize('echocoder.preflight.error', 'EchoCoder runtime preflight failed: {0}', preflight.issues.join(' | ')));
		} else if (preflight.warnings.length > 0) {
			notificationService.warn(localize('echocoder.preflight.warn', 'EchoCoder runtime warnings: {0}', preflight.warnings.join(' | ')));
		}
	}
}

registerWorkbenchContribution2(EchocoderRuntimePreflightContribution.ID, EchocoderRuntimePreflightContribution, WorkbenchPhase.AfterRestored);

class EchocoderRuntimePreflightAction extends Action2 {
	constructor() {
		super({
			id: 'echocoder.runtime.preflight',
			title: localize2('echocoder.runtime.preflight', 'EchoCoder: Validate Runtime Environment'),
			f1: true,
		});
	}

	override run(accessor: ServicesAccessor): void {
		const runtimeService = accessor.get(IEchocoderAgentRuntimeService);
		const notifications = accessor.get(INotificationService);
		const preflight = runtimeService.validateEnvironment();
		if (!preflight.ok) {
			notifications.error(localize('echocoder.runtime.preflight.failed', 'EchoCoder preflight failed: {0}', preflight.issues.join(' | ')));
			return;
		}
		if (preflight.warnings.length > 0) {
			notifications.warn(localize('echocoder.runtime.preflight.warning', 'EchoCoder preflight warnings: {0}', preflight.warnings.join(' | ')));
			return;
		}
		notifications.info(localize('echocoder.runtime.preflight.ok', 'EchoCoder runtime preflight passed.'));
	}
}

class EchocoderCancelActiveRunAction extends Action2 {
	constructor() {
		super({
			id: 'echocoder.runtime.cancelActive',
			title: localize2('echocoder.runtime.cancelActive', 'EchoCoder: Cancel Active Run'),
			f1: true,
		});
	}

	override run(accessor: ServicesAccessor): void {
		const runtimeService = accessor.get(IEchocoderAgentRuntimeService);
		const notifications = accessor.get(INotificationService);
		if (!runtimeService.isBusy) {
			notifications.info(localize('echocoder.runtime.cancel.none', 'No active EchoCoder run.'));
			return;
		}
		runtimeService.cancelAllRuns('cancelled from command palette');
		notifications.info(localize('echocoder.runtime.cancel.done', 'Requested cancellation for active EchoCoder runs.'));
	}
}

class EchocoderRunPromptAction extends Action2 {
	constructor() {
		super({
			id: 'echocoder.runtime.runPrompt',
			title: localize2('echocoder.runtime.runPrompt', 'EchoCoder: Run Prompt (Core Runtime)'),
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const runtimeService = accessor.get(IEchocoderAgentRuntimeService);
		const notifications = accessor.get(INotificationService);
		const quickInputService = accessor.get(IQuickInputService);
		const workspaceContextService = accessor.get(IWorkspaceContextService);

		const prompt = await quickInputService.input({
			title: localize('echocoder.runtime.runPrompt.title', 'EchoCoder Prompt'),
			prompt: localize('echocoder.runtime.runPrompt.placeholder', 'Ask EchoCoder to explain, edit, or compose changes...'),
			placeHolder: localize('echocoder.runtime.runPrompt.ph', 'Enter prompt'),
			validateInput: value => value.trim().length > 0 ? undefined : localize('echocoder.runtime.runPrompt.empty', 'Prompt is required.'),
		});

		if (!prompt) {
			return;
		}

		try {
			const firstFolder = workspaceContextService.getWorkspace().folders[0];
			const cwd = firstFolder?.uri.fsPath || '';
			const handle = await runtimeService.startRun({
				mode: 'chat',
				prompt,
				cwd,
			});

			const runStore = handle.onEvent(e => {
				if (e.kind === 'error') {
					notifications.error(localize('echocoder.runtime.runPrompt.errorEvent', 'EchoCoder run failed: {0}', e.message ?? 'Unknown error'));
					runStore.dispose();
				}
				if (e.kind === 'state' && e.state && e.state !== 'running') {
					if (e.state === 'success') {
						notifications.info(localize('echocoder.runtime.runPrompt.done', 'EchoCoder run completed.'));
					} else if (e.state === 'cancelled') {
						notifications.info(localize('echocoder.runtime.runPrompt.cancelled', 'EchoCoder run cancelled.'));
					}
					runStore.dispose();
				}
			});
		} catch (error) {
			notifications.error(localize('echocoder.runtime.runPrompt.failed', 'Unable to start EchoCoder run: {0}', error instanceof Error ? error.message : String(error)));
		}
	}
}

registerAction2(EchocoderRuntimePreflightAction);
registerAction2(EchocoderCancelActiveRunAction);
registerAction2(EchocoderRunPromptAction);
