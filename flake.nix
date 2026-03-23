{
  description = "abs-norm Audiobookshelf custom metadata provider";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        absNorm = pkgs.buildNpmPackage {
          pname = "abs-norm";
          version = "0.1.0";
          src = ./.;
          npmDepsHash = "sha256-OabTGhB9zwY+WB7CrC1bKAT+pL1ViJ9GAyyddgdvdOY=";
          dontNpmBuild = true;
          dontConfigure = true;
          dontBuild = true;
          nativeBuildInputs = [ pkgs.makeWrapper ];
          installPhase = ''
            runHook preInstall

            mkdir -p $out/lib/abs-norm $out/bin
            cp -r . $out/lib/abs-norm/

            makeWrapper ${pkgs.nodejs_22}/bin/node $out/bin/abs-norm \
              --add-flags "$out/lib/abs-norm/src/server.js"

            runHook postInstall
          '';
        };

        containerImage = pkgs.dockerTools.buildLayeredImage {
          name = "abs-norm";
          tag = "nix";
          contents = [ absNorm pkgs.cacert ];
          config = {
            Cmd = [ "abs-norm" ];
            ExposedPorts = { "8042/tcp" = { }; };
            Env = [
              "PORT=8042"
              "PUBLIC_BASE_URL=http://localhost:8042"
            ];
          };
        };
      in {
        packages.default = absNorm;
        packages.abs-norm = absNorm;
        packages.containerImage = containerImage;

        apps.default = flake-utils.lib.mkApp { drv = absNorm; };
        apps.abs-norm = flake-utils.lib.mkApp { drv = absNorm; };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            gnumake
            curl
            jq
            pre-commit
            docker-compose
            docker
          ];
        };
      });
}
