{ pkgs, ... }:

{
  packages = with pkgs; [
    wgo
  ];
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs-slim_22;
    npm.enable = true;
    npm.install.enable = true;
  };
  languages.go = {
    enable = true;
  };
  env = {
    PRIMO_SUPERUSER_EMAIL = "admin@primo.internal";
    PRIMO_SUPERUSER_PASSWORD = "test1234";
    PRIMO_USER_EMAIL = "user@primo.internal";
    PRIMO_USER_PASSWORD = "test1234";
    PRIMO_DISABLE_USAGE_STATS = "true";
  };
  processes = {
    app-dev.exec = "vite --config app.config.js dev";
    common-build.exec = "vite --config common.config.js build --watch";
    server.exec = "wgo -dir internal go run . serve --dev";
  };
  devcontainer = {
    enable = true;
    settings.customizations.vscode.extensions = [
      "bbenoist.Nix"
      "svelte.svelte-vscode"
      "esbenp.prettier-vscode"
      "eamodio.gitlens"
      "golang.go"
    ];
  };
}
