interface PluginConfig extends GeneratorConfig {
  dev?: boolean;
  suffixes?: string[];
}

interface GeneratorConfig {
  length?: number;
  min?: number;
  max?: number;
}
