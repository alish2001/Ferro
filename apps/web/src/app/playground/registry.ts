import type { ComponentFixture } from "./types";

import { animatedProgressFixture } from "./fixtures/animated-progress.fixture";
import { buttonFixture } from "./fixtures/button.fixture";
import { cardFixture } from "./fixtures/card.fixture";
import { compositorPreviewFixture } from "./fixtures/compositor-preview.fixture";
import { fieldCardFixture } from "./fixtures/field-card.fixture";
import { generationStatusFixture } from "./fixtures/generation-status.fixture";
import { heroBackdropFixture } from "./fixtures/hero-backdrop.fixture";
import { graphicCardFixture } from "./fixtures/graphic-card.fixture";
import { modelSelectorFixture } from "./fixtures/model-selector.fixture";
import { pendingAssistantTextFixture } from "./fixtures/pending-assistant-text.fixture";
import { pipelineFlowchartFixture } from "./fixtures/pipeline-flowchart.fixture";
import { resolutionSelectorFixture } from "./fixtures/resolution-selector.fixture";
import { themeSelectorFixture } from "./fixtures/theme-selector.fixture";
import { spinnerFixture } from "./fixtures/spinner.fixture";
import { stageDetailFixture } from "./fixtures/stage-detail.fixture";
import { statusPillFixture } from "./fixtures/status-pill.fixture";
import { transcriptionDebugPanelFixture } from "./fixtures/transcription-debug-panel.fixture";

export const fixtures: ComponentFixture<any>[] = [
  // Base UI
  buttonFixture,
  spinnerFixture,
  statusPillFixture,
  animatedProgressFixture,
  cardFixture,
  heroBackdropFixture,
  resolutionSelectorFixture,
  modelSelectorFixture,
  themeSelectorFixture,
  // Upload
  fieldCardFixture,
  transcriptionDebugPanelFixture,
  generationStatusFixture,
  // Preview
  graphicCardFixture,
  compositorPreviewFixture,
  pendingAssistantTextFixture,
  // Dev Mode
  pipelineFlowchartFixture,
  stageDetailFixture,
];
