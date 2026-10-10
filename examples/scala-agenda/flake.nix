{
  description = "Example: a Basecamp view over the scala core module";

  inputs = {
    # The same builder the scala core and its view use (Basecamp 0.3).
    logos-module-builder.url = "github:logos-co/logos-module-builder/0.3.1";
    # The example reads calendars and posts comments through the scala core (comments need 0.12.0+).
    scala.url = "github:vpavlin/scala/bca401c040732ffc22ea0b76b3a40b33f39da40d";
  };

  outputs = inputs@{ logos-module-builder, scala, ... }:
    logos-module-builder.lib.mkLogosQmlModule {
      src = ./.;
      configFile = ./metadata.json;
      flakeInputs = inputs;
    };
}
