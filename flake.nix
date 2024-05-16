{
  # Override nixpkgs to use the latest set of node packages
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/master";
  inputs.systems.url = "github:nix-systems/default";

  outputs =
    { self
    , nixpkgs
    , flake-utils
    , systems
    }:
    flake-utils.lib.eachSystem (import systems)
      (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs

            pkgs.nodePackages.pnpm

            pkgs.nodePackages.typescript
            pkgs.nodePackages.typescript-language-server

            (pkgs.wrangler.override {
              version = "3.55.0";
              src = pkgs.fetchurl {
                url = "https://registry.npmjs.org/wrangler/-/wrangler-3.55.0.tgz";
                sha256 = "sha256-WonpMS6v7Kr2Eruu9Zh1+gP0Ii1ECkkkpC0FmHkXb7U=";
              };
            })
          ];
        };
      });
}
