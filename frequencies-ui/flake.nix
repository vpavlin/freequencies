{
  description = "Frequencies: organise club nights on top of the Scala calendar (pure-QML view over the scala core module)";

  inputs = {
    # The same builder the scala core and its view use (Basecamp 0.3).
    logos-module-builder.url = "github:logos-co/logos-module-builder/0.3.1";
    # Frequencies reads and writes Scala's calendars through the scala core (comments need postExt: 0.12.0+).
    scala.url = "github:vpavlin/scala/ef7b1ffbb64ffe013717cbe2b4e65f22f4fa5ae6";
  };

  outputs = inputs@{ logos-module-builder, scala, ... }:
    logos-module-builder.lib.mkLogosQmlModule {
      src = ./.;
      configFile = ./metadata.json;
      flakeInputs = inputs;
    };
}
