{
  description = "Frequencies: organise club nights on top of the Scala calendar (pure-QML view over the scala core module)";

  inputs = {
    # The same builder the scala core and its view use (Basecamp 0.3).
    logos-module-builder.url = "github:logos-co/logos-module-builder/0.3.1";
    # Frequencies reads and writes Scala's calendars through the scala core (comments need postExt: 0.12.0+).
    scala.url = "github:vpavlin/scala/ef7b1ffbb64ffe013717cbe2b4e65f22f4fa5ae6";
    # Artists come from Kith's books through the kith core (ADR 0004); kith 0.3.1.
    kith.url = "github:vpavlin/kith/d338a7852374bcdba40a32dcec8f399d20b078c5";
    # Booking / crew / guest-list forms through the whisperbox_core module (ADR 0005); whisperbox_core 0.4.1.
    whisperbox_core.url = "github:vpavlin/whisperbox-logos/accc756bca592a6d76469dc0c86fa83e740d5a2b?dir=whisperbox_core";
  };

  outputs = inputs@{ logos-module-builder, scala, kith, whisperbox_core, ... }:
    logos-module-builder.lib.mkLogosQmlModule {
      src = ./.;
      configFile = ./metadata.json;
      flakeInputs = inputs;
    };
}
