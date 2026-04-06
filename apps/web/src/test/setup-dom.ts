import { GlobalRegistrator } from "@happy-dom/global-registrator"

// Register a minimal DOM environment for hook/component tests only.
// Pure module tests should not import this file.
GlobalRegistrator.register()

