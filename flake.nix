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
              version = "3.52.0";
              src = pkgs.fetchurl {
                url = "https://registry.npmjs.org/wrangler/-/wrangler-3.52.0.tgz";
                sha256 = "sha256-7N0Faul8XGjSWbyGXwFSgAe8K3pbYuAuSeY6TfslvL0=";
              };
            })
          ];
        };
      });
}
