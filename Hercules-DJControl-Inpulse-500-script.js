
// DJControl_Inpulse_500_script.js
//
// ***************************************************************************
// * Mixxx mapping script file for the Hercules DJControl Inpulse 500.
// * Authors: Ev3nt1ne, DJ Phatso, resetreboot 
// *    contributions by Kerrick Staley, Bentheshrubber, ThatOneRuffian
//
//  Version 1.6c: (August 2023) resetreboot
//  * Requires Mixxx >= 2.3.4
//  * Volume meters follow correctly the selected channel
//  * Use the full 14 bits for knobs for more precission 
//  * Add effects to the PAD 7 mode
//  * Create decks for four channel mode
//  * Change the behavior of the FX buttons, use them as Channel selector, using the LEDs
//    as indicators of current channel.
//
//
//  * When enabling multichannel, ensure:
//    - Beat matching guide follows correctly the selected channels
//
//  * Move the sampler buttons to the Deck component as well as the new effect buttons
//  * Made the filter knob have a function with filter, effect and filter + effect
//  * Use the Hotcue component for hotcues
//  * Use components and add for the rest of the controls:
//    - Play
//    - Cue
//    - Sync
//    - Volume fader
//    - EQs
//    - PFL
//    - Pad Selectors
//    - Loop PADs
//    - Roll PADs
//    - Beat jump PADs
//    - Tone key PADs
//    - Slicer
//    - Loop pot
//    - In and Out loop
//    - Load button
//    - Vinyl
//    - Slip
//    - Quant
//    - Pitch fader
//    - Jog wheels (Using the new JogWheelBasic component!
//      - Also probably fixed the shift behavior not working properly
//
//  * Added option so the browser knob can behave with out of focus window
//
// * Version 1.5c (Summer 2023)
// * Forum: https://mixxx.discourse.group/t/hercules-djcontrol-inpulse-500/19739
// * Wiki: https://mixxx.org/wiki/doku.php/hercules_djcontrol_inpulse_500
//
//  Version 1.0c:
//	* Hot Cue: implementation of the Color API (Work in progress)
//		- Assigned color directly to pad (XML)
//	* Added DECK LED number - On when playing
//  * Moved Beatjump to Pad mode 3 (Slicer)
//	* Set different color for upper (Sampler 1-4) and lower (Sampler 5-8) sampler pads
//
//  Version 1.0 - Based upon Inpulse 300 v1.2 (official)
//
// TO DO: 
//  * Browser knob has a ton of colors to do things!
//  * Vinyl + SHIFT led should reflect brake status
//  * Quant + SHIFT led should reflect key lock status
//  * Add beat jump + SHIFT jumps
//
// ****************************************************************************
var DJCi500 = {};
///////////////////////////////////////////////////////////////
//                       USER OPTIONS                        //
///////////////////////////////////////////////////////////////

// If you are spinning your set list and you have your Mixxx window out
// of focus and you want to be able to use the browser knob to traverse
// the current crate or playlist, set to true. Especially useful to spin
// when using Twitch, VRChat or Second Life
DJCi500.browserOffFocusMode = false;

// Colors
DJCi500.PadColorMapper = new ColorMapper({
  0xFF0000: 0x60,
  0xFFFF00: 0x7C,
  0x00FF00: 0x1C,
  0x00FFFF: 0x1F,
  0x0000FF: 0x03,
  0xFF00FF: 0x42,
  0xFF88FF: 0x63,
  0xFFFFFF: 0x7F,
  0x000088: 0x02,
  0x008800: 0x10,
  0x008888: 0x12,
  0x228800: 0x30,
  0x880000: 0x40,
  0x882200: 0x4C,
  0x888800: 0x50,
  0x888888: 0x52,
  0x88FF00: 0x5C,
  0xFF8800: 0x74,
});


///////////////////////////////////////////////////////////////
//                          SLICER                           //
///////////////////////////////////////////////////////////////
DJCi500.selectedSlicerDomain = [8, 8, 8, 8]; //length of the Slicer domain
//PioneerDDJSX.slicerDomains = [8, 16, 32, 64];

// slicer storage:
DJCi500.slicerBeatsPassed = [0, 0, 0, 0];
DJCi500.slicerPreviousBeatsPassed = [0, 0, 0, 0];
DJCi500.slicerTimer = [false, false, false, false];
//DJCi500.slicerJumping = [0, 0, 0, 0];
DJCi500.slicerActive = [false, false, false, false];
DJCi500.slicerAlreadyJumped = [false, false, false, false];
DJCi500.slicerButton = [-1, -1, -1, -1];
DJCi500.slicerModes = {
  'contSlice': 0,
  'loopSlice': 1
};
DJCi500.activeSlicerMode = [
  DJCi500.slicerModes.contSlice,
  DJCi500.slicerModes.contSlice,
  DJCi500.slicerModes.contSlice,
  DJCi500.slicerModes.contSlice
];
DJCi500.slicerLoopBeat8 = [0, 0, 0, 0];
///////////////////////

// Master VU Meter callbacks
DJCi500.vuMeterUpdateMaster = function(value, _group, control) {
  // Reserve the red led for peak indicator, this will in turn, make
  // the display more similar (I hope) to what Mixxx VU shows
  value = script.absoluteLinInverse(value, 0.0, 1.0, 0, 124);
  var control = (control === "VuMeterL") ? 0x40 : 0x41;
  midi.sendShortMsg(0xB0, control, value);
};

DJCi500.vuMeterPeakLeftMaster = function(value, group, control, status) {
  if (value) {
    midi.sendShortMsg(0x90, 0x0A, 0x7F);
  } else {
    midi.sendShortMsg(0x90, 0x0A, 0x00);
  }
};

DJCi500.vuMeterPeakRightMaster = function(value, group, control, status) {
  if (value) {
    midi.sendShortMsg(0x90, 0x0F, 0x7F);
  } else {
    midi.sendShortMsg(0x90, 0x0F, 0x00);
  }
};

// Deck VU Meter callbacks
DJCi500.vuMeterUpdateDeck = function(value, group, _control, _status) {
  // Reserve the red led for peak indicator, this will in turn, make
  // the display more similar (I hope) to what Mixxx VU shows
  value = script.absoluteLinInverse(value, 0.0, 1.0, 0, 125);
  if (DJCi500.deckA.currentDeck === group) {
    midi.sendShortMsg(0xB1, 0x40, value);
  } else if (DJCi500.deckB.currentDeck === group) {
    midi.sendShortMsg(0xB2, 0x40, value);
  }
};

DJCi500.vuMeterPeakDeck = function(value, group, _control, _status) {
  var channel = 0x00;
  if (DJCi500.deckA.currentDeck === group) {
    channel = 0x91;
  } else if (DJCi500.deckB.currentDeck === group) {
    channel = 0x92;
  }

  if (channel > 0x00) {
    if (value) {
      midi.sendShortMsg(channel, 0x39, 0x7F);
    } else {
      midi.sendShortMsg(channel, 0x39, 0x00);
    }
  }
};

DJCi500.numberIndicator = function(value, group, _control, _status) {
  if (DJCi500.deckA.currentDeck === group) {
    midi.sendShortMsg(0x91, 0x30, value);
  } else if (DJCi500.deckB.currentDeck === group) {
    midi.sendShortMsg(0x92, 0x30, value);
  }
}

DJCi500.fxSelIndicator = function(_value, group, _control, _status) {
  var deckA = DJCi500.deckA.currentDeck;
  var deckB = DJCi500.deckB.currentDeck;
  var active = false;

  if (group === "[EffectRack1_EffectUnit1]") {
    active = engine.getValue(group, 'group_' + deckA + '_enable');
    if (active) {
      midi.sendShortMsg(0x96, 0x63, 0x74);
    } else {
      midi.sendShortMsg(0x96, 0x63, 0x00);
    }
    active = engine.getValue(group, 'group_' + deckB + '_enable');
    if (active) {
      midi.sendShortMsg(0x97, 0x63, 0x74);
    } else {
      midi.sendShortMsg(0x97, 0x63, 0x00);
    }
  } else if (group === "[EffectRack1_EffectUnit2]") {
    active = engine.getValue(group, 'group_' + deckA + '_enable');
    if (active) {
      midi.sendShortMsg(0x96, 0x67, 0x74);
    } else {
      midi.sendShortMsg(0x96, 0x67, 0x00);
    }
    active = engine.getValue(group, 'group_' + deckB + '_enable');
    if (active) {
      midi.sendShortMsg(0x97, 0x67, 0x74);
    } else {
      midi.sendShortMsg(0x97, 0x67, 0x00);
    }
  }
}

DJCi500.Deck = function (deckNumbers, midiChannel) {
  components.Deck.call(this, deckNumbers);
  // Allow components to access deck variables
  var deckData = this;

  // For loop and looprolls
  var fractions = ['0.125', '0.25', '0.5', '1', '2', '4', '8', '16'];

  // For key shift pads and beat jump pads
  var pairColorsOn = [0x1F, 0x1F, 0x03, 0x03, 0x74, 0x74, 0x60, 0x60]; 
  var pairColorsOff = [0x12, 0x12, 0x02, 0x02, 0x4C, 0x4C, 0x40, 0x40]; 

  // Brake status for this deck
  this.slowPauseSetState = [false, false, false, false];

  // Vinyl button state
  this.vinylButtonState = [true, true, true, true];

  // Pitch ranges and status
  this.pitchRanges = [0.08, 0.32, 1]; //select pitch range
  this.pitchRangeId = 0; //id of the array, one for each deck

  // Effect section components
  this.onlyEffectEnabled = false;
  this.filterAndEffectEnabled = false;

  // Make sure the shift button remaps the shift actions
  this.shiftButton = new components.Button({
    midi: [0x90 + midiChannel, 0x04],
    input: function(_channel, _control, value, _status, _group) {
      if (value === 0x7F) {
        deckData.forEachComponent(function(component) {
          if (component.unshift) {
            component.shift();
          }
        });
      } else {
        deckData.forEachComponent(function(component) {
          if (component.unshift) {
            component.unshift();
          }
        });
      }
    },
  });

  this.loadButton = new components.Button({
    midi: [0x90 + midiChannel, 0x0D],
    shiftOffset: 3,
    shiftControl: false,
    shiftChannel: true,
    sendShifted: true,
    unshift: function () {
      this.inKey = 'LoadSelectedTrack';
    },
    shift: function () {
      this.inKey = 'eject';
    },
  });

  // Transport section
  // Play button, for some reason the group is not correct on this one?
  this.playButton = new components.PlayButton({
    midi: [0x90 + midiChannel, 0x07],
    shiftOffset: 3,
    shiftControl: false,
    shiftChannel: true,
    sendShifted: true,
    unshift: function () {
      this.input = function (channel, control, value, status, group) {
        if (value === 0x7F) {
          if (engine.getValue(deckData.currentDeck, "play_latched")) {      //play_indicator play_latched
            var deck = parseInt(deckData.currentDeck.charAt(8));
            if (deckData.slowPauseSetState[deck - 1]) {
              engine.brake(deck,
                1,//((status & 0xF0) !=== 0x80 && value > 0),
                54);
            } else {
              engine.setValue(deckData.currentDeck, "play", false);
            }
          } else {
            engine.setValue(deckData.currentDeck, "play", true);
          }
        }
      };
    },
    shift: function () {
      this.input = function (_channel, _control, _value, _status, group) {
        engine.setValue(deckData.currentDeck, "play_stutter", true);
      };
    },
  });

  this.cueButton = new components.CueButton({
    midi: [0x90 + midiChannel, 0x06],
    shiftOffset: 3,
    shiftControl: false,
    shiftChannel: true,
    sendShifted: true,
    shift: function () {
      this.inKey = "start_play";
    },
  });

  this.syncButton = new components.SyncButton({
    midi: [0x90 + midiChannel, 0x05],
    shiftOffset: 3,
    shiftControl: false,
    shiftChannel: true,
    sendShifted: true,
    shift: function () {
      this.inKey = "sync_key";
    },
  });

  this.pflButton = new components.Button({
    midi: [0x90 + midiChannel, 0x0C],
    type: components.Button.prototype.types.toggle,
    key: 'pfl',
  });

  // Top controls
  // Vinyl button
  this.vinylButton = new components.Button({
    midi: [0x90 + midiChannel, 0x03],
    shiftOffset: 3,
    shiftControl: false,
    shiftChannel: true,
    sendShifted: true,
    unshift: function () {
      this.input = function(channel, _control, value, status, group) {
        if (value === 0x7F) {
          var deck = parseInt(deckData.currentDeck.charAt(8)) - 1;
          var new_status = !deckData.vinylButtonState[deck];
          deckData.jogWheel.vinylMode = new_status;
          deckData.jogWheelShift.vinylMode = new_status;
          deckData.vinylButtonState[deck] = new_status;
          var new_message = new_status ? 0x7F : 0x00;
          midi.sendShortMsg(this.midi[0], 0x03, new_message);
        } 
      };
    },
    shift: function () {
      this.input = function (channel, control, value, status, group) {
        if (value === 0x7F){
          var deck = parseInt(deckData.currentDeck.charAt(8)) - 1;
          deckData.slowPauseSetState[deck] = !deckData.slowPauseSetState[deck];
        }
      };
    }
  });

  // SLIP mode button
  this.slipButton = new components.Button({
    midi: [0x90 + midiChannel, 0x01],
    type: components.Button.prototype.types.toggle,
    shiftOffset: 3,
    shiftControl: false,
    shiftChannel: true,
    sendShifted: true,
    key: 'slip_enabled',
  });

  // Quant button
  this.quantButton =  new components.Button({
    midi: [0x90 + midiChannel, 0x02],
    type: components.Button.prototype.types.toggle,
    shiftOffset: 3,
    shiftControl: false,
    shiftChannel: true,
    sendShifted: true,
    outKey: 'quantize', 
    unshift: function () {
      this.inKey = 'quantize';
    },
    shift: function () {
      this.inKey = 'keylock';
    },
  });

  // Knobs
  this.volume = new components.Pot({
    midi: [0xB0 + midiChannel, 0x00],
    inKey: 'volume',
  });

  this.eqKnob = [];
  for (var k = 1; k <= 3; k++) {
    this.eqKnob[k] = new components.Pot({
      midi: [0xB0 + midiChannel, 0x01 + k],
      group: '[EqualizerRack1_' + this.currentDeck + '_Effect1]',
      inKey: 'parameter' + k,
    });
  }

  this.gainKnob = new components.Pot({
    midi: [0xB0 + midiChannel, 0x05],
    key: 'pregain',
  });

  // Pitch-tempo fader
  this.pitchFader = new components.Pot({
    midi: [0xB0 + midiChannel, 0x08],
    key: 'rate',
  });

  // Jog Wheel
  // TODO: Handle with less repeat the shift key for this
  this.jogWheel = new components.JogWheelBasic({
    midi: [0xB0 + midiChannel, 0x0A],
    deck: midiChannel, // whatever deck this jogwheel controls, in this case we ignore it
    wheelResolution: 248, // how many ticks per revolution the jogwheel has
    alpha: 1/8,
    beta: (1/8)/32,
    rpm: 33 + 1/3,
    inputWheel: function(_channel, _control, value, _status, group) {
      var deck = parseInt(deckData.currentDeck.charAt(8));
      value = this.inValueScale(value);
      if (engine.isScratching(deck)) {
        engine.scratchTick(deck, value);
      } else {
        this.inSetValue(value);
      }
    },
    inputTouch: function(channel, control, value, status, group) {
      var deck = parseInt(deckData.currentDeck.charAt(8));
      if ((value === 0x7F) && deckData.vinylButtonState[deck - 1]) {
        engine.scratchEnable(deck,
          this.wheelResolution,
          this.rpm,
          this.alpha,
          this.beta);
      } else {
        engine.scratchDisable(deck);
      }
    },
  });

  this.jogWheelShift = new components.JogWheelBasic({
    midi: [0xB3 + midiChannel, 0x0A],
    deck: midiChannel, // whatever deck this jogwheel controls, in this case we ignore it
    wheelResolution: 248, // how many ticks per revolution the jogwheel has
    alpha: 1/8,
    beta: 1/8/32,
    rpm: 33 + 1/3,
    inputWheel: function(_channel, _control, value, _status, group) {
      var deck = parseInt(deckData.currentDeck.charAt(8));
      value = this.inValueScale(value) * 4; 
      if (engine.isScratching(deck)) {
        engine.scratchTick(deck, value);
      } else {
        this.inSetValue(value);
      }
    },
    inputTouch: function(channel, control, value, status, group) {
      var deck = parseInt(deckData.currentDeck.charAt(8));
      if (this.isPress(channel, control, value, status) && this.vinylMode) {
        engine.scratchEnable(deck,
          this.wheelResolution,
          this.rpm,
          this.alpha,
          this.beta);
      } else {
        engine.scratchDisable(deck);
      }
    },
  });

  // Loop controls
  this.loopInButton = new components.Button({
    midi: [0x90 + midiChannel, 0x09],
    shiftOffset: 3,
    shiftControl: false,
    shiftChannel: true,
    sendShifted: true,
    outKey: 'loop_enabled',    // TODO: Check with loop_in?
    unshift: function () {
      this.inKey = 'loop_in';
    },
    shift: function () {
      this.inKey = 'loop_in_goto';
    },
  });

  this.loopOutButton = new components.Button({
    midi: [0x90 + midiChannel, 0x0A],
    shiftOffset: 3,
    shiftControl: false,
    shiftChannel: true,
    sendShifted: true,
    outKey: 'loop_enabled',    // TODO: Check with loop_in?
    unshift: function () {
      this.inKey = 'loop_out';
    },
    shift: function () {
      this.inKey = 'loop_out_goto';
    },
  });

  // Loop rotary encoder functions
  //
  // Push the rotary encoder
  this.loopEncoderPush = new components.Button({
    midi: [0x90 + midiChannel, 0x2C],
    shiftOffset: 3,
    shiftControl: false,
    shiftChannel: true,
    sendShifted: true,
    unshift: function () {
      this.inKey = 'reloop_toggle';
    },
    shift: function () {
      this.inKey = 'beatloop_4_activate';
    },
  });

  // Loop encoder
  this.loopEncoder = new components.Encoder({
    midi: [0xB0 + midiChannel, 0x0E],
    shiftOffset: 3,
    shiftControl: false,
    shiftChannel: true,
    sendShifted: true,
    input: function (channel, control, value, status, group) {
      // FIXME: Toggle for loop halve and double??
      var deckGroup = deckData.currentDeck;
      if (value >= 0x40) {
        engine.setValue(deckGroup, "loop_halve", true);
      } else {
        engine.setValue(deckGroup, "loop_double", true);
      }
    }
  });

  // We only check and attach for slicer mode, but we have all
  // pad buttons here if we need something extra!
  this.padSelectButtons = [];
  for (var i = 1; i <= 8; i++) {
    this.padSelectButtons[i] = new components.Button({
      midi: [0x90 + midiChannel, 0x0F + (i - 1)],
      input: function(channel, control, value, status, group) {
        var deck = parseInt(deckData.currentDeck.charAt(8)) - 1;
        if (control === 0x11) {
          DJCi500.slicerActive[deck] = true;
        } else {
          DJCi500.slicerActive[deck] = false;
        }
      },
    });
  }

  // Hotcue buttons (PAD Mode 1)
  this.hotcueButtons = [];
  for (var i = 1; i <= 8; i++) {
    this.hotcueButtons[i] = new components.HotcueButton({
      midi: [0x95 + midiChannel, 0x00 + (i - 1)],
      number: i,
      shiftOffset: 8,
      shiftControl: true,
      sendShifted: true,
      colorMapper: DJCi500.PadColorMapper,
      off: 0x00,
    });
  };

  // Loop buttons (PAD Mode 2)
  this.loopButtons = [];
  for (var i = 1; i <= 8; i++) {
    this.loopButtons[i] = new components.Button({
      midi: [0x95 + midiChannel, 0x10 + (i - 1)],
      number: i,
      shiftOffset: 8,
      shiftControl: true,
      sendShifted: true,
      on: 0x5C,
      off: 0x30,
      key: 'beatloop_' + fractions[i - 1] + '_toggle',
    });
  };

  // Slicer buttons (PAD Mode 3)
  this.slicerButtons = [];
  for (var i = 1; i <= 8; i++) {
    this.slicerButtons[i] = new components.Button({
      midi: [0x95 + midiChannel, 0x20 + (i - 1)],
      number: i,
      shiftOffset: 8,
      shiftControl: true,
      sendShifted: true,
      input: function(channel, control, value, status, group) {
        // This is kind of a hack... somehow this is not getting the group correctly!
        DJCi500.slicerButtonFunc(channel, control, value, status, deckData.currentDeck);
      },
    });
  };

  // Sampler buttons (PAD Mode 4)
  this.samplerButtons = [];
  for (var i = 1; i <= 8; i++) {
    this.samplerButtons[i] = new components.SamplerButton({
      midi: [0x95 + midiChannel, 0x30 + (i - 1)],
      number: i,
      shiftOffset: 8,
      shiftControl: true,
      sendShifted: true,
      loaded: 0x42,
      empty: 0x00,
      playing: 0x63,
      looping: 0x74,
    });
  };

  // Pitch buttons (PAD Mode 5)
  this.pitchDownTone = new components.Button({
    midi: [0x95 + midiChannel, 0x40],
    on: pairColorsOn[0],
    off: pairColorsOff[0],
    input: function (channel, control, value, status, group) {
      if (value === 0x7F){
        engine.setValue(group, "pitch_adjust", -2.0);
        midi.sendShortMsg(status, control, this.on);
      }
      else {
        midi.sendShortMsg(status, control, this.off);
      }
    },
  });

  this.pitchDownSemiTone = new components.Button({
    midi: [0x95 + midiChannel, 0x41],
    on: pairColorsOn[1],
    off: pairColorsOff[1],
    input: function (channel, control, value, status, group) {
      if (value === 0x7F){
        engine.setValue(group, "pitch_down", 1);
        midi.sendShortMsg(status, control, this.on);
      }
      else {
        midi.sendShortMsg(status, control, this.off);
      }
    },
  });

  this.pitchUpSemiTone = new components.Button({
    midi: [0x95 + midiChannel, 0x42],
    on: pairColorsOn[2],
    off: pairColorsOff[2],
    input: function (channel, control, value, status, group) {
      if (value === 0x7F){
        engine.setValue(group, "pitch_up", 1);
        midi.sendShortMsg(status, control, this.on);
      }
      else {
        midi.sendShortMsg(status, control, this.off);
      }
    },
  });

  this.pitchUpTone = new components.Button({
    midi: [0x95 + midiChannel, 0x43],
    on: pairColorsOn[3],
    off: pairColorsOff[3],
    input: function (channel, control, value, status, group) {
      if (value === 0x7F){
        engine.setValue(group, "pitch_adjust", 2.0);
        midi.sendShortMsg(status, control, this.on);
      }
      else {
        midi.sendShortMsg(status, control, this.off);
      }
    },
  });

  this.pitchSliderIncrease = new components.Button({
    midi: [0x95 + midiChannel, 0x44],
    on: pairColorsOn[4],
    off: pairColorsOff[4],
    input: function (channel, control, value, status, group) {
      if (value === 0x7F){
        deckData.pitchRangeId++;
        if (deckData.pitchRangeId > 2)
        {
          deckData.pitchRangeId = 2;
        }
        engine.setValue(group, "rateRange", deckData.pitchRanges[deckData.pitchRangeId]);
        midi.sendShortMsg(status, control, this.on); //17 -- 3B
      }
      else {
        midi.sendShortMsg(status, control, this.off); //3B -- 33
      }
    },
  });

  this.pitchSliderDecrease = new components.Button({
    midi: [0x95 + midiChannel, 0x45],
    on: pairColorsOn[5],
    off: pairColorsOff[5],
    input: function (channel, control, value, status, group) {
      if (value === 0x7F){
        deckData.pitchRangeId = deckData.pitchRangeId - 1;
        if (deckData.pitchRangeId < 0)
        {
          deckData.pitchRangeId = 0;
        }
        engine.setValue(group, "rateRange", deckData.pitchRanges[deckData.pitchRangeId]);
        midi.sendShortMsg(status, control, this.on); //17 -- 3B
      }
      else {
        midi.sendShortMsg(status, control, this.off); //3B -- 33
      }
    },
  });

  this.pitchSliderReset = new components.Button({
    midi: [0x95 + midiChannel, 0x46],
    on: pairColorsOn[6],
    off: pairColorsOff[6],
    input: function (channel, control, value, status, group) {
      if (value === 0x7F){
        deckData.pitchRangeId = 0;
        engine.setValue(group, "rateRange", deckData.pitchRanges[deckData.pitchRangeId]);
        midi.sendShortMsg(status, control, this.on); //17 -- 3B
      }
      else {
        midi.sendShortMsg(status, control, this.off); //3B -- 33
      }
    },
  });

  // Beatloop rolls buttons (PAD Mode 6)
  this.rollButtons = [];
  for (var i = 1; i <= 8; i++) {
    this.rollButtons[i] = new components.Button({
      midi: [0x95 + midiChannel, 0x50 + (i - 1)],
      number: i,
      shiftOffset: 8,
      shiftControl: true,
      sendShifted: true,
      on: 0x1F,
      off: 0x12,
      key: 'beatlooproll_' + fractions[i - 1] + '_activate',
    });
  };

  // Effect buttons (PAD Mode 7)
  this.effectButtons = [];
  for (var i = 1; i <= 3; i++) {
    // First top row effects buttons, just the effect, disable HPF/LPF knob
    this.effectButtons[i] = new components.Button({
      midi: [0x95 + midiChannel, 0x60 + (i - 1)],
      number: i,
      shiftOffset: 8,
      shiftControl: true,
      sendShifted: true,
      group: "[EffectRack1_EffectUnit" + midiChannel + "_Effect" + i + "]",
      outKey: "enabled",
      output: function (_value, group, control) {
        if (deckData.onlyEffectEnabled) {
          this.send(0x7F);
        } else {
          this.send(0x7C);
        }
      },
      unshift: function() {
        // Normal effect button operation, toggling the effect assigned to it
        this.input = function (channel, control, value, status, group) {
          var fxNo = control - 0x5F;
          var unit = channel - 0x95;
          if (value === 0x7F){
            deckData.filterAndEffectEnabled = false;
            deckData.onlyEffectEnabled = !engine.getValue(this.group, "enabled");
            script.toggleControl(this.group, "enabled");
          }
        };
      },
      shift: function () {
        // Shift button will change the effect to the next in the list
        this.input = function (channel, control, value, status, group) {
          var fxNo = control - 0x67;
          var unit = channel - 0x95;
          if (value === 0x7F){
            engine.setValue(this.group, 'effect_selector', +1);
          }
        };
      }
    });

    // Lower row, effect + HPF/LPF button on filter knob
    this.effectButtons[i + 4] = new components.Button({
      midi: [0x95 + midiChannel, 0x60 + (i + 3)],
      number: i + 4,
      shiftOffset: 8,
      shiftControl: true,
      sendShifted: true,
      group: "[EffectRack1_EffectUnit" + midiChannel + "_Effect" + i + "]",
      outKey: "enabled",
      output: function (_value, group, control) {
        if (deckData.filterAndEffectEnabled) {
          this.send(0x7F);
        } else {
          this.send(0x7C);
        }
      },
      unshift: function() {
        // Normal effect button operation, toggling the effect assigned to it
        this.input = function (channel, control, value, status, group) {
          var fxNo = control - 0x63;
          var unit = channel - 0x95;
          if (value === 0x7F){
            deckData.filterAndEffectEnabled = !engine.getValue(this.group, "enabled");
            deckData.onlyEffectEnabled = false;
            script.toggleControl(this.group, "enabled");
          }
        };
      },
      shift: function () {
        // Shift button will change the effect to the next in the list
        this.input = function (channel, control, value, status, group) {
          var fxNo = control - 0x6B;
          var unit = channel - 0x95;
          if (value === 0x7F){
            engine.setValue(this.group, 'effect_selector', -1);
          }
        };
      }
    });
  };

  // Set the current channel FX route with the two extra PADs
  this.effectButtons[4] = new components.Button({
    midi: [0x95 + midiChannel, 0x63],
    number: 4,
    shiftOffset: 8,
    shiftControl: true,
    sendShifted: true,
    group: "[EffectRack1_EffectUnit1]",
    input: function (channel, _control, value, _status, group) {
      if (value === 0x7F) {
        var deckGroup = deckData.currentDeck;
        script.toggleControl(this.group, 'group_' + deckGroup + '_enable');
      }
    }
  });

  this.effectButtons[8] = new components.Button({
    midi: [0x95 + midiChannel, 0x67],
    number: 8,
    shiftOffset: 8,
    shiftControl: true,
    sendShifted: false,
    group: "[EffectRack1_EffectUnit2]",
    input: function (_channel, _control, value, _status, _group) {
      if (value === 0x7F) {
        var deckGroup = deckData.currentDeck;
        script.toggleControl(this.group, 'group_' + deckGroup + '_enable');
      }
    }
  });

  // Filter knob is here since it is affected by effects pads
  this.filterKnob = new components.Pot({
    midi: [0xB0 + midiChannel, 0x01],
    number: midiChannel,
    group: "[QuickEffectRack1_[Channel" + midiChannel + "]]",
    input: function (channel, control, value, status, group) {
      if ((deckData.onlyEffectEnabled) || (deckData.filterAndEffectEnabled)) {
        // Move the effects knobs
        engine.setValue("[EffectRack1_EffectUnit" + this.number + "]", "super1", Math.abs(script.absoluteNonLin(value, 0.0, 0.5, 1.0, 0, 127) - 0.5)*2 );
      }
      if ((deckData.filterAndEffectEnabled) || (!deckData.onlyEffectEnabled)) {
        // Move the filter knob
        engine.setValue("[QuickEffectRack1_" + deckData.currentDeck + "]", "super1", script.absoluteNonLin(value, 0.0, 0.5, 1.0, 0, 127));
      }
    },
  });

  // Beat jump (PAD Mode 8)
  this.beatJumpButtons = [];
  var values = [1, 1, 2, 2, 4, 4, 8, 8];
  for (var i = 1; i <= 8; i++) {
    var movement = (i % 2 === 0) ? '_forward' : '_backward';
    this.beatJumpButtons[i] = new components.Button({
      midi: [0x95 + midiChannel, 0x70 + (i - 1)],
      number: i,
      on: pairColorsOn[i-1],
      off: pairColorsOff[i-1],
      key: 'beatjump_' + values[i - 1] + movement,
    });
  };

  // As per Mixxx wiki, set the group properties
  this.reconnectComponents(function (c) {
    if (c.group === undefined) {
      c.group = this.currentDeck;
    }
  });
}

// Give the custom Deck all the methods of the generic deck
DJCi500.Deck.prototype = new components.Deck();

// INIT for the controller and decks
DJCi500.init = function() {
  DJCi500.AutoHotcueColors = true;

  // Take care of the status of the crossfader status
  DJCi500.crossfaderEnabled = true;
  DJCi500.xFaderScratch = false;

  // Turn On Vinyl buttons LED(one for each deck).
  midi.sendShortMsg(0x91, 0x03, 0x7F);
  midi.sendShortMsg(0x92, 0x03, 0x7F);

  //Turn On Browser button LED
  midi.sendShortMsg(0x90, 0x05, 0x10);

  // Connect the VUMeters
  engine.makeConnection("[Channel1]", "VuMeter", DJCi500.vuMeterUpdateDeck);
  engine.getValue("[Channel1]", "VuMeter", DJCi500.vuMeterUpdateDeck);
  engine.makeConnection("[Channel2]", "VuMeter", DJCi500.vuMeterUpdateDeck);
  engine.getValue("[Channel2]", "VuMeter", DJCi500.vuMeterUpdateDeck);
  engine.makeConnection("[Channel3]", "VuMeter", DJCi500.vuMeterUpdateDeck);
  engine.getValue("[Channel3]", "VuMeter", DJCi500.vuMeterUpdateDeck);
  engine.makeConnection("[Channel4]", "VuMeter", DJCi500.vuMeterUpdateDeck);
  engine.getValue("[Channel4]", "VuMeter", DJCi500.vuMeterUpdateDeck);

  // Deck VU meters peak indicators
  engine.makeConnection("[Channel1]", "PeakIndicator", DJCi500.vuMeterPeakDeck);
  engine.makeConnection("[Channel2]", "PeakIndicator", DJCi500.vuMeterPeakDeck);
  engine.makeConnection("[Channel3]", "PeakIndicator", DJCi500.vuMeterPeakDeck);
  engine.makeConnection("[Channel4]", "PeakIndicator", DJCi500.vuMeterPeakDeck);

  // Connect number leds
  engine.makeConnection("[Channel1]", "play_indicator", DJCi500.numberIndicator);
  engine.getValue("[Channel1]", "play_indicator", DJCi500.numberIndicator);
  engine.makeConnection("[Channel2]", "play_indicator", DJCi500.numberIndicator);
  engine.getValue("[Channel2]", "play_indicator", DJCi500.numberIndicator);
  engine.makeConnection("[Channel3]", "play_indicator", DJCi500.numberIndicator);
  engine.getValue("[Channel3]", "play_indicator", DJCi500.numberIndicator);
  engine.makeConnection("[Channel4]", "play_indicator", DJCi500.numberIndicator);
  engine.getValue("[Channel4]", "play_indicator", DJCi500.numberIndicator);

  // Connect Master VU meter 
  engine.makeConnection("[Master]", "VuMeterL", DJCi500.vuMeterUpdateMaster);
  engine.makeConnection("[Master]", "VuMeterR", DJCi500.vuMeterUpdateMaster);
  engine.makeConnection("[Master]", "PeakIndicatorL", DJCi500.vuMeterPeakLeftMaster);
  engine.makeConnection("[Master]", "PeakIndicatorR", DJCi500.vuMeterPeakRightMaster);

  engine.getValue("[Master]", "VuMeterL", DJCi500.vuMeterUpdateMaster);
  engine.getValue("[Master]", "VuMeterR", DJCi500.vuMeterUpdateMaster);
  engine.getValue("[Controls]", "AutoHotcueColors", "DJCi500.AutoHotcueColors");

  // Connect the FX selection leds
  engine.makeConnection("[EffectRack1_EffectUnit1]", "group_[Channel1]_enable", DJCi500.fxSelIndicator);
  engine.makeConnection("[EffectRack1_EffectUnit2]", "group_[Channel1]_enable", DJCi500.fxSelIndicator);
  engine.makeConnection("[EffectRack1_EffectUnit1]", "group_[Channel2]_enable", DJCi500.fxSelIndicator);
  engine.makeConnection("[EffectRack1_EffectUnit2]", "group_[Channel2]_enable", DJCi500.fxSelIndicator);
  engine.makeConnection("[EffectRack1_EffectUnit1]", "group_[Channel3]_enable", DJCi500.fxSelIndicator);
  engine.makeConnection("[EffectRack1_EffectUnit2]", "group_[Channel3]_enable", DJCi500.fxSelIndicator);
  engine.makeConnection("[EffectRack1_EffectUnit1]", "group_[Channel4]_enable", DJCi500.fxSelIndicator);
  engine.makeConnection("[EffectRack1_EffectUnit2]", "group_[Channel4]_enable", DJCi500.fxSelIndicator);

  // Connect the slicer beats
  DJCi500.slicerBeat1 = engine.makeConnection('[Channel1]', 'beat_active', DJCi500.slicerBeatActive);
  DJCi500.slicerBeat2 = engine.makeConnection('[Channel2]', 'beat_active', DJCi500.slicerBeatActive);
  //var controlsToFunctions = {'beat_active': 'DJCi500.slicerBeatActive'};
  //script.bindConnections('[Channel1]', controlsToFunctions, true);

  // Ask the controller to send all current knob/slider values over MIDI, which will update
  // the corresponding GUI controls in MIXXX.
  midi.sendShortMsg(0xB0, 0x7F, 0x7F);

  // Turn on lights:
  for (var i = 0; i < 2; i++) {
    midi.sendShortMsg(0x96+i, 0x40, 0x2);
    midi.sendShortMsg(0x96+i, 0x41, 0x2);
    midi.sendShortMsg(0x96+i, 0x42, 0x78);
    midi.sendShortMsg(0x96+i, 0x43, 0x78);
    midi.sendShortMsg(0x96+i, 0x45, 0x37);
    midi.sendShortMsg(0x96+i, 0x46, 0x24);
  }

  DJCi500.tempoTimer = engine.beginTimer(250,"DJCi500.tempoLEDs()");

  // FX buttons, light them to signal the current deck 1 and 2 as active
  midi.sendShortMsg(0x90, 0x14, 0x7F);
  midi.sendShortMsg(0x90, 0x15, 0x7F);

  // Create the deck objects
  DJCi500.deckA = new DJCi500.Deck([1, 3], 1);
  DJCi500.deckB = new DJCi500.Deck([2, 4], 2);
  DJCi500.deckA.setCurrentDeck("[Channel1]");
  DJCi500.deckB.setCurrentDeck("[Channel2]");

  // Update the fx rack selection
  DJCi500.fxSelIndicator(0, "[EffectRack1_EffectUnit1]", 0, 0);
  DJCi500.fxSelIndicator(0, "[EffectRack1_EffectUnit2]", 0, 0);
};

// Crossfader control, set the curve
DJCi500.crossfaderSetCurve = function(channel, control, value, _status, _group) {
  switch(value) {
    case 0x00:
      // Mix
      script.crossfaderCurve(0,0,127);
      DJCi500.xFaderScratch = false;
      break;
    case 0x7F:
      // Scratch
      script.crossfaderCurve(127,0,127);
      DJCi500.xFaderScratch = true;
      break;
  }
}

// Crossfader enable or disable
DJCi500.crossfaderEnable = function(channel, control, value, _status, _group) {
  if(value) {  
    DJCi500.crossfaderEnabled = true;
  } else {
    DJCi500.crossfaderEnabled = false;
    engine.setValue("[Master]", "crossfader", 0);    // Set the crossfader in the middle
  }
}

// Crossfader function
DJCi500.crossfader = function(channel, control, value, status, group) {
  if (DJCi500.crossfaderEnabled) {
    // Eventine's crossfader scratch mode
    if (DJCi500.xFaderScratch) {
      var result = 0;
      if (value <= 0) {
        result = -1;
      } 
      else if (value >= 127) {
        result = 1;
      }
      else {
        result = Math.tan((value-64)*Math.PI/2/63)/32;
      }
      engine.setValue(group, "crossfader", result);
    }
    else {
      engine.setValue(group, "crossfader", (value/64)-1);
    }
  }
}

// Browser button. We move it to a custom JS function to avoid having to focus the Mixxx window for it to respond
DJCi500.moveLibrary = function(channel, control, value, status, group) {
  if (value > 0x3F) {
    if (DJCi500.browserOffFocusMode) {
      engine.setValue('[Playlist]', 'SelectTrackKnob', -1);
    } else {
      engine.setValue('[Library]', 'MoveUp', 1);
    }
  } else {
    if (DJCi500.browserOffFocusMode) {
      engine.setValue('[Playlist]', 'SelectTrackKnob', 1);
    } else {
      engine.setValue('[Library]', 'MoveDown', 1);
    }
  }
}

DJCi500.spinback_button = function(channel, control, value, status, group) {
  var deck = parseInt(group.substring(8,9)); // work out which deck we are using
  engine.spinback(deck, value > 0, 2.5); // use default starting rate of -10 but decrease speed more quickly
}

//Led
DJCi500.tempoLEDs = function () {
  // Current active decks
  var deckA = DJCi500.deckA.currentDeck;
  var deckB = DJCi500.deckB.currentDeck;

  //Tempo:
  var tempo1 = engine.getValue(deckA, "bpm");
  var tempo2 = engine.getValue(deckB, "bpm");
  var diff = tempo1 - tempo2;

  //Check double tempo:
  var doubleTempo = 0;
  if (diff > 0){
    if ((tempo1 / tempo2) > 1.5){doubleTempo = 1; diff = tempo1/2 - tempo2;}
  }
  else{
    if ((tempo2 / tempo1) > 1.5){doubleTempo = 1; diff = tempo1 - tempo2/2;}
  }

  if ( diff < -0.25)
  {
    //Deck1
    midi.sendShortMsg(0x91, 0x1E, 0x0);
    midi.sendShortMsg(0x91, 0x1F, 0x7F);
    midi.sendShortMsg(0x91, 0x2C, 0x0);
    //Deck2
    midi.sendShortMsg(0x92, 0x1F, 0x0);
    midi.sendShortMsg(0x92, 0x1E, 0x7F);
    midi.sendShortMsg(0x92, 0x2C, 0x0);

    //clear beatalign leds
    //Deck1
    midi.sendShortMsg(0x91, 0x1C, 0x0);
    midi.sendShortMsg(0x91, 0x1D, 0x0);
    midi.sendShortMsg(0x91, 0x2D, 0x0);
    //Deck2
    midi.sendShortMsg(0x92, 0x1C, 0x0);
    midi.sendShortMsg(0x92, 0x1D, 0x0);
    midi.sendShortMsg(0x92, 0x2D, 0x0);
  }
  else if ( diff > 0.25)
  {
    //Deck1
    midi.sendShortMsg(0x91, 0x1F, 0x0);
    midi.sendShortMsg(0x91, 0x1E, 0x7F);
    midi.sendShortMsg(0x91, 0x2C, 0x0);
    //Deck2
    midi.sendShortMsg(0x92, 0x1E, 0x0);
    midi.sendShortMsg(0x92, 0x1F, 0x7F);
    midi.sendShortMsg(0x92, 0x2C, 0x0);

    //clear beatalign leds
    //Deck1
    midi.sendShortMsg(0x91, 0x1C, 0x0);
    midi.sendShortMsg(0x91, 0x1D, 0x0);
    midi.sendShortMsg(0x91, 0x2D, 0x0);
    //Deck2
    midi.sendShortMsg(0x92, 0x1C, 0x0);
    midi.sendShortMsg(0x92, 0x1D, 0x0);
    midi.sendShortMsg(0x92, 0x2D, 0x0);
  }
  else {
    //Deck1
    midi.sendShortMsg(0x91, 0x1E, 0x0);
    midi.sendShortMsg(0x91, 0x1F, 0x0);
    midi.sendShortMsg(0x91, 0x2C, 0x7F);
    //Deck2
    midi.sendShortMsg(0x92, 0x1E, 0x0);
    midi.sendShortMsg(0x92, 0x1F, 0x0);
    midi.sendShortMsg(0x92, 0x2C, 0x7F);

    //Do beat alignement only if the tracks are already on Tempo
    // and only if they are playing
    if ( (engine.getValue(deckA, "play_latched")) && (engine.getValue(deckB, "play_latched")) ){

      var beat1 = engine.getValue(deckA, "beat_distance");
      var beat2 = engine.getValue(deckB, "beat_distance");
      if (doubleTempo){
        if (tempo1 > tempo2){
          if (beat2 > 0.5){
            beat2 -= 0.5;
          }
          beat2 *= 2;
        }
        else{ //tempo2 >(=) tempo1
          if (beat1 > 0.5){
            beat1 -= 0.5;
          }
          beat1 *= 2;
        }
      }
      diff = beat1 - beat2;
      if (diff < 0){
        diff = 1+diff;
      }
      if ((diff < 0.02) || (diff > 1-0.02))
      {
        //Deck1
        midi.sendShortMsg(0x91, 0x1C, 0x0);
        midi.sendShortMsg(0x91, 0x1D, 0x0);
        midi.sendShortMsg(0x91, 0x2D, 0x7F);
        //Deck2
        midi.sendShortMsg(0x92, 0x1C, 0x0);
        midi.sendShortMsg(0x92, 0x1D, 0x0);
        midi.sendShortMsg(0x92, 0x2D, 0x7F);
      }
      else if ( diff < 0.5)
      {
        //Deck1
        midi.sendShortMsg(0x91, 0x1C, 0x0);
        midi.sendShortMsg(0x91, 0x1D, 0x7F);
        midi.sendShortMsg(0x91, 0x2D, 0x0);
        //Deck2
        midi.sendShortMsg(0x92, 0x1D, 0x0);
        midi.sendShortMsg(0x92, 0x1C, 0x7F);
        midi.sendShortMsg(0x91, 0x2D, 0x0);
      }
      else {
        //Deck1
        midi.sendShortMsg(0x91, 0x1D, 0x0);
        midi.sendShortMsg(0x91, 0x1C, 0x7F);
        midi.sendShortMsg(0x91, 0x2D, 0x0);
        //Deck2
        midi.sendShortMsg(0x92, 0x1C, 0x0);
        midi.sendShortMsg(0x92, 0x1D, 0x7F);
        midi.sendShortMsg(0x92, 0x2D, 0x0);
      }
    }//if playing
    else {
      //Deck1
      midi.sendShortMsg(0x91, 0x1C, 0x0);
      midi.sendShortMsg(0x91, 0x1D, 0x0);
      midi.sendShortMsg(0x91, 0x2D, 0x0);
      //Deck2
      midi.sendShortMsg(0x92, 0x1C, 0x0);
      midi.sendShortMsg(0x92, 0x1D, 0x0);
      midi.sendShortMsg(0x92, 0x2D, 0x0);
    }
  }//else tempo
};

// After a channel change, make sure we read the current status
DJCi500.updateDeckStatus = function(group) {
  var playing = engine.getValue(group, "play_indicator");
  var volume = script.absoluteLinInverse(engine.getValue(group, "VuMeter"), 0.0, 1.0, 0, 127);

  // Update the vinyl button
  var vinylState = false;
  var deckIndex = parseInt(group.charAt(8)) - 1;
  var channel = ((group === "[Channel1]") || (group === "[Channel3]")) ? 1 : 2;
  if (channel === 1) {
    vinylState = DJCi500.deckA.vinylButtonState[deckIndex];
  } else {
    vinylState = DJCi500.deckB.vinylButtonState[deckIndex];
  }
  midi.sendShortMsg(0x90 + channel, 0x03, (vinylState) ? 0x7F : 0x00);
  midi.sendShortMsg(0xB0 + channel, 0x40, volume);
  midi.sendShortMsg(0x90 + channel, 0x30, playing ? 0x7F : 0x00);

  // Update the fx rack selection
  DJCi500.fxSelIndicator(0, "[EffectRack1_EffectUnit1]", 0, 0);
  DJCi500.fxSelIndicator(0, "[EffectRack1_EffectUnit2]", 0, 0);

  // Slicer
  switch(group) {
    case "[Channel1]":
      DJCi500.slicerBeat1.disconnect();
      DJCi500.slicerBeat1 = engine.makeConnection('[Channel1]', 'beat_active', DJCi500.slicerBeatActive);
      DJCi500.slicerBeat1.trigger();
      break;
    case "[Channel2]":
      DJCi500.slicerBeat2.disconnect();
      DJCi500.slicerBeat2 = engine.makeConnection('[Channel2]', 'beat_active', DJCi500.slicerBeatActive);
      DJCi500.slicerBeat2.trigger();
      break;
    case "[Channel3]":
      DJCi500.slicerBeat1.disconnect();
      DJCi500.slicerBeat1 = engine.makeConnection('[Channel3]', 'beat_active', DJCi500.slicerBeatActive);
      DJCi500.slicerBeat1.trigger();
      break;
    case "[Channel4]":
      DJCi500.slicerBeat2.disconnect();
      DJCi500.slicerBeat2 = engine.makeConnection('[Channel4]', 'beat_active', DJCi500.slicerBeatActive);
      DJCi500.slicerBeat2.trigger();
      break;
  };
}

// This is where we choose the channel using the FX buttons and light them
// up correctly
DJCi500.deckSelector = function(channel, control, value, status, group) {
  if (value === 0x7F) {
    var deckChosen = control - 0x13;   // FX1 is 0x14, so this will yield the number
    switch (deckChosen) {
      case 1:
        DJCi500.deckA.setCurrentDeck("[Channel1]");
        DJCi500.updateDeckStatus("[Channel1]");
        midi.sendShortMsg(0x90, 0x14, 0x7F);
        midi.sendShortMsg(0x90, 0x16, 0x00);
        break;
      case 2:
        DJCi500.deckB.setCurrentDeck("[Channel2]");
        DJCi500.updateDeckStatus("[Channel2]");
        midi.sendShortMsg(0x90, 0x15, 0x7F);
        midi.sendShortMsg(0x90, 0x17, 0x00);
        break;
      case 3:
        DJCi500.deckA.setCurrentDeck("[Channel3]");
        DJCi500.updateDeckStatus("[Channel3]");
        midi.sendShortMsg(0x90, 0x14, 0x00);
        midi.sendShortMsg(0x90, 0x16, 0x7F);
        break;
      case 4:
        DJCi500.deckB.setCurrentDeck("[Channel4]");
        DJCi500.updateDeckStatus("[Channel4]");
        midi.sendShortMsg(0x90, 0x15, 0x00);
        midi.sendShortMsg(0x90, 0x17, 0x7F);
        break;
    };
  };
};

///////////////////////////////////////////////////////////////
//                          SLICER                           //
///////////////////////////////////////////////////////////////
  DJCi500.slicerButtonFunc = function(channel, control, value, status, group) {
    var index = control - 0x20,
      deck = parseInt(group.charAt(8)) - 1,
      domain = DJCi500.selectedSlicerDomain[deck],
      beatsToJump = 0,
      passedTime = engine.getValue(group, "beat_distance"),
      loopEnabled = engine.getValue(group, "loop_enabled");

    if (value) {
      DJCi500.slicerButton[deck] = index;
      //Maybe I need to update this (seems sometimes it does not work.)
      //DJCi500.slicerBeatsPassed[deck] = Math.floor((playposition * duration) * (bpm / 60.0));
      beatsToJump = (index * (domain / 8)) - ((DJCi500.slicerBeatsPassed[deck] % domain));
      beatsToJump -= passedTime;

      //activate the one-shot timer for the slip end.
      if (!DJCi500.slicerTimer[deck]){
        DJCi500.slicerTimer[deck] = true;
        var timer_ms = (1-passedTime)*60.0/engine.getValue(group, "bpm")*1000;

        //quality of life fix for not-precise hands or beatgrid
        // also good fix for really small timer_ms values.
        if ( (passedTime >= 0.8) &&
          //this is because while looping doing this thing on beat 8 break the flow.
          ((!loopEnabled) || (DJCi500.slicerBeatsPassed[deck] % domain) !== (domain-1)) ) {
          timer_ms += 60.0/engine.getValue(group, "bpm")*1000;
        }

        engine.beginTimer( timer_ms,
          //"DJCi500.slicerTimerCallback("+group+")", true);
          function() {
            //need to do this otherwise loop does not work on beat 8 because of slip.
            if ((engine.getValue(group, "loop_enabled") === true)){
              //on the wiki it says it returns an integer, but I tested and instead seems a Real value:
              // But it does not work cuz the value does not relate to beat. they are samples.
              //var endLoop = engine.getValue(group, "loop_end_position");
              engine.setValue(group, "reloop_toggle", true); //false
              engine.setValue(group, "slip_enabled", false);
              //Aleatory behavior, probably because the slip does not always have completed before "returning"
              //so I need to introduce a timer waiting the slip function to be completely resolved
              engine.beginTimer( 2, function () {
                var bpm_file = engine.getValue(group, "file_bpm"),
                  playposition = engine.getValue(group, "playposition"),
                  duration = engine.getValue(group, "duration");
                /*
                if (Math.floor((playposition * duration) * (bpm_file / 60.0)) > endLoop) {
                  engine.setValue(group, "beatjump", -8);
                }*/
                engine.setValue(group, "reloop_toggle", true);},
                true);
            }
            else {
              engine.setValue(group, "slip_enabled", false);
            }
            DJCi500.slicerTimer[deck] = false;
            DJCi500.slicerButton[deck] = -1;},
          true);
      }

      engine.setValue(group, "slip_enabled", true);

      //Because of Mixxx beatjump implementation, we need to deactivate the loop before jumping
      // also there is no "lopp_deactivate" and loop_activate false does not work.
      if (loopEnabled) {
        engine.setValue(group, "reloop_toggle", true);
      }
      engine.setValue(group, "beatjump", beatsToJump);
      //This sadly does not work.
      //engine.setValue(group, "loop_move", -beatsToJump);
      if (loopEnabled){
        engine.setValue(group, "reloop_toggle", true);
      }
      midi.sendShortMsg((0x96+(deck % 2)), 0x20+index, 0x62);
    } //if value
  };

//this below is connected to beat_active
DJCi500.slicerBeatActive = function(value, group, control) {
  // This slicer implementation will work for constant beatgrids only!
  var deck = parseInt(group.charAt(8)) - 1;
  var channel = deck % 2;

  print("***** SLICER ACTIVE VALUE: " + DJCi500.slicerActive[deck]);
  print("***** SLICER: deck " + deck + " channel " + channel);

  var bpm = engine.getValue(group, "file_bpm"),
    playposition = engine.getValue(group, "playposition"),
    duration = engine.getValue(group, "duration"),
    slicerPosInSection = 0,
    ledBeatState = false,
    domain = DJCi500.selectedSlicerDomain[deck];

  //this works.
  if (engine.getValue(group, "beat_closest") === engine.getValue(group, "beat_next")) {
    return;
  }

  DJCi500.slicerBeatsPassed[deck] = Math.floor((playposition * duration) * (bpm / 60.0));

  if (DJCi500.slicerActive[deck]){
    slicerPosInSection = Math.floor((DJCi500.slicerBeatsPassed[deck] % domain) / (domain / 8));
    // PAD Led control:
    if (DJCi500.slicerButton[deck] !== slicerPosInSection) {
      for (var i = 0; i < 8; i++) {
        active = ((slicerPosInSection === i) ? ledBeatState : !ledBeatState) ? 0x03 : 0x7F;
        midi.sendShortMsg((0x96+channel), 0x20+i, active);
      }
    } else {
      midi.sendShortMsg((0x96+channel), 0x20+DJCi500.slicerButton[deck], 0x62);
    }
  } else {
    DJCi500.slicerAlreadyJumped[deck] = false;
    DJCi500.slicerPreviousBeatsPassed[deck] = 0;
  }
};

DJCi500.shutdown = function() {
  //cleanup
  midi.sendShortMsg(0x90, 0x05, 0x00); //turn browser led off
  midi.sendShortMsg(0xB0, 0x7F, 0x7E);
};
