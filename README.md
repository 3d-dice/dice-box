# Dice-Box

High performance 3D dice roller module made with [BabylonJS](https://www.babylonjs.com/), [AmmoJS](https://github.com/kripken/ammo.js/) and implemented with [web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) and [offscreenCanvas](https://doc.babylonjs.com/divingDeeper/scene/offscreenCanvas). Designed to be easy to integrate into your own JavaScript app.

**Version 1.0.5 just released!** 

![Demo Screenshot](https://github.com/3d-dice/dice-box/blob/main/dice-screenshot.jpg)

## Docs

The docs site is available at [fantasticdice.games](https://fantasticdice.games)

## Demo

New demos for version 1.0.5! <br>
Try out the kitchen sink demo at https://d3rivgcgaqw1jo.cloudfront.net/index.html <br>
See the kitchen sink code demo here: https://codesandbox.io/s/3d-dice-demo-v1-0-5-sm4ien <br>
Here's a simple React Demo for rolling attributes (using 3d6): https://codesandbox.io/s/react-roller-attributes-v1-0-5-65uqhv <br>
Here's a React Demo with support for advanced dice notation: https://codesandbox.io/s/react-roller-advanced-notation-v1-0-5-rz0nmr

Note: Some demos includes other `@3d-dice` modules such as [dice-roller-parser](https://github.com/3d-dice/dice-roller-parser), [dice-ui](https://github.com/3d-dice/dice-ui), and [dice-parser-interface](https://github.com/3d-dice/dice-parser-interface). Advanced dice notation, such as `4d6dl1` or `4d6!r<2`, is supported with these modules

## Quickstart (sort of)

Install the library using:

```
npm install @3d-dice/dice-box
```

When installing the library, the terminal will ask you to identify your destination for static assets. This defaults to `/public/assets` and will timeout after 10 seconds. You can always manually move these files. They can be found in the `@3d-dice/dice-box/src/assets` folder. Copy everything from this folder to your local static assets or public folder.

This is an ES module intended to be part of a build system. To import the module into your project use:

```javascript
import DiceBox from "@3d-dice/dice-box";
```

Then create a new instance of the `DiceBox` class. The arguments are first a selector for the target DOM node followed by an object of config options. Be sure to set the path to the assets folder copied earlier. It's the only required config option.

```javascript
const diceBox = new DiceBox("#dice-box", {
  assetPath: "/assets/dice-box", // required
});
```

Next you initialize the class object then it will be ready to roll some dice. The `init` method is an async method so it can be awaited or followed by a `.then()` method.

```javascript
diceBox.init().then(() => {
  diceBox.roll("2d20");
});
```

## Usage

Dice-Box can only accept simple dice notations and a modifier such as `2d20` or `2d6+4` It returns a result object once the dice have stopped rolling. For more advanced rolling features you'll want to look at adding [dice-parser-interface](https://github.com/3d-dice/dice-parser-interface) which supports the full [Roll20 Dice Specification](https://help.roll20.net/hc/en-us/articles/360037773133-Dice-Reference#DiceReference-RollTemplates).

### Configuration Options
See [Configuration Options](https://fantasticdice.games/docs/usage/config#configuration-options) on the docs site

### Common Objects

See [Common Objects](https://fantasticdice.games/docs/usage/objects) on the docs site

### Methods
See [Methods](https://fantasticdice.games/docs/usage/methods) on the docs site

### Callbacks
See [Callbacks](https://fantasticdice.games/docs/usage/callbacks) on the docs site

## Other setup options

In my demo project I have it set up as seen below. You probably won't need the `BoxControls` but they're fun to play with. See this demo in Code Sandbox here: https://codesandbox.io/s/3d-dice-demo-v1-0-2-sm4ien

```javascript
import './style.css'
import DiceBox from '@3d-dice/dice-box'
import { DisplayResults, AdvancedRoller, BoxControls } from '@3d-dice/dice-ui'

let Box = new DiceBox("#dice-box",{
  assetPath: '/assets/dice-box/',
})

document.addEventListener("DOMContentLoaded", async() => {

  Box.init().then(() => {

    // create dat.gui controls
    const Controls = new BoxControls({
      themes: ["default", "rust", "diceOfRolling", "gemstone"],
      themeColor: world.config.themeColor,
      onUpdate: (updates) => {
        Box.updateConfig(updates);
      }
    });
    Controls.themeSelect.setValue(world.config.theme);
    Box.onThemeConfigLoaded = (themeData) => {
      if (themeData.themeColor) {
        Controls.themeColorPicker.setValue(themeData.themeColor);
      }
    };

    // create display overlay
    const Display = new DisplayResults("#dice-box")

    // create Roller Input
    const Roller = new AdvancedRoller({
      target: '#dice-box',
      onSubmit: (notation) => Box.roll(notation),
      onClear: () => {
        Box.clear()
        Display.clear()
      },
      onReroll: (rolls) => {
        // loop through parsed roll notations and send them to the Box
        rolls.forEach(roll => Box.add(roll))
      },
      onResults: (results) => {
        Display.showResults(results)
      }
    })

    // pass dice rolls to Advanced Roller to handle
    Box.onRollComplete = (results) => {
      Roller.handleResults(results)
    }
  }) // end Box.init
}) // end DOMContentLoaded
```

```css
html,
body {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}

#dice-box {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  background-image: url(./assets/woodgrain2.jpg);
  background-size: cover;
}

#dice-box canvas {
  width: 100%;
  height: 100%;
}
```

## Other Projects

### [Dice UI](https://github.com/3d-dice/dice-ui)
A collection of vanilla UI modules for Dice Box.

Including:

  1. Advanced Roller Input - a simple form input that allows advanced roll notations
  2. Dice Picker - clickable dice icons for adding dice to a roll. Good for mobile devices.
  3. Display Results - shows the roll results in a modal popup
  4. Box Controls - uses [dat.gui](https://github.com/dataarts/dat.gui) to display configurable dice-box options.

### [Dice Themes](https://github.com/3d-dice/dice-themes)
A collection of [CC0](https://creativecommons.org/share-your-work/public-domain/cc0/) models and themes you can use with Dice Box.

### [Dice Roller Parser](https://github.com/3d-dice/dice-roller-parser)
A string parser that returns an object containing the component parts of a dice roll. It supports the full [Roll20 Dice Specification](https://roll20.zendesk.com/hc/en-us/articles/360037773133-Dice-Reference#DiceReference-Roll20DiceSpecification)


### [Dice Parser Interface](https://github.com/3d-dice/dice-parser-interface)
Offers a simple interface between `Dice Roller Parser` and `Dice Box`. This module sends string notations to the parser and breaks them down into notations Dice Box can use. Also sends Dice Box results to the parser to generate the final roll results. Will also handle events that trigger rerolls and exploding dice.


## Plugs

### Quest Portal
Special thanks to the team at [Quest Portal](https://www.questportal.com/) for supporting and assisting with the development of this dice roller. They've been kind enough to supply some license free dice models that I can distribute with this project. In addition to that, they've provided some good feedback and testing while incorporating `@3d-dice/dice-box` into their platform. Sign up for [early access](https://app.questportal.com/signup) at Quest Portal to see what they're cooking up.

### Dice So Nice

If you're looking for a 3D dice roller that works with [three.js](https://threejs.org/) than I would recommend looking into [Dice So Nice](https://gitlab.com/riccisi/foundryvtt-dice-so-nice/-/tree/master)

### Dice of Rolling

My favorite theme for this project has been the Dice of Rolling theme based on the real [Dice of Rolling](https://diceofrolling.com/#dice). Great product and I really enjoy using them in real life.

### Owlbear Rodeo
Another great platform if all you need is an interactive virtual map and dice. [Owlbear Rodeo](https://www.owlbear.rodeo/) has created really amazing tools that work well for any platform. Bring your own character sheets.
