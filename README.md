# Dice-Box
High performance 3D dice roller module made with [BabylonJS](https://www.babylonjs.com/), [AmmoJS](https://github.com/kripken/ammo.js/) and implemented with [web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) and [offscreenCanvas](https://doc.babylonjs.com/divingDeeper/scene/offscreenCanvas). Designed to be easy to integrate into your own JavaScript app.

![Demo Screenshot](https://github.com/3d-dice/dice-box/blob/main/dice-screenshot.jpg)

## Demo
New demo for version 0.5! <br>
Try out the kitchen sink demo at https://d3rivgcgaqw1jo.cloudfront.net/index.html <br>
See the kitchen sink code demo here: https://codesandbox.io/s/3d-dice-demo-2bily5 <br>
Here's a simple React Demo for rolling attributes (using 3d6): https://codesandbox.io/s/react-roller-attributes-6jjiod <br>
Here's a React Demo with support for advanced dice notation: https://codesandbox.io/s/react-roller-advanced-notation-xl8foh

Note: Some demos includes other `@3d-dice` modules such as [dice-roller-parser](https://github.com/3d-dice/dice-roller-parser), [FUI](https://github.com/3d-dice/FUI), and [FDP](https://github.com/3d-dice/FDP). Advanced dice notation is supported here such as `4d6dl1` or `4d6!r<2`

## Quickstart (sort of)
Install the library using:
```
npm install @3d-dice/dice-box
```

After installing the library, you'll need to copy some files over to your development folder. They can be found in the `@3d-dice/dice-box/src/assets` folder. Copy everything from this folder to your local static assets or public folder.

This is an ES module intended to be part of a build system. To import the module into your project use:
```javascript
import DiceBox from '@3d-dice/dice-box'
```

Then create a new instance of the `DiceBox` class. The arguments are first a selector for the target DOM node followed by an object of config options. Be sure to set the path to the assets folder copied earlier. It's the only required config option.
```javascript
const diceBox = new DiceBox("#dice-box", {
  assetPath: '/assets/'
})
```

Next you initialize the class object then it will be ready to roll some dice. The `init` method is an async method so it can be awaited or followed by a `.then()` method.
```javascript
diceBox.init().then(()=>{
  diceBox.roll('2d20')
})
```

## Usage
Dice-Box can only accept simple dice notations and a modifier such as `2d20` or `2d6+4` It returns a result object once the dice have stopped rolling. For more advanced rolling features you'll want to look at adding [@3d-dice/dice_roller](https://github.com/3d-dice/dice_roller) which supports the full [Roll20 Dice Specification](https://help.roll20.net/hc/en-us/articles/360037773133-Dice-Reference#DiceReference-RollTemplates).

### Configuration Options
| Option | Default Setting|Description|
|-|-|-|
|id|'dice-canvas'|The ID of the canvas element to use. If no canvas present then one will be created|
|assetPath|'/assets/'|The path to files needed by this module|
|gravity|3|Too much gravity will cause the dice to jitter. Too little and they take much longer to settle.
|mass|3|The mass of the dice. Affects how forces act on the dice such as spin|
|friction|.8|The friction of the dice and the dice box they roll on|
|restitution|0|The bounciness of the dice|
|angularDamping|.4|Determines how quickly the dice lose their spin (angular momentum)|
|linearDamping|.5|Determines how quickly the dice lose their linear momentum|
|spinForce|6|The maximum amout of spin the dice may have|
|throwForce|2.5|The maximum amout of throwing force used|
|startingHeight|15|The height at which the toss begins|
|settleTimeout|5000|Time in ms before a die is stopped from moving|
|offscreen|true|If offscreenCanvas is available it will be used|
|delay|10|The delay between dice being generate. If they're all generated at the same time they instantly collide with each other which doesn't look very natural.|
|enableShadows|true|Do the dice cast a shadow? Turn off for a performance bump|
|theme|'purpleRock'|HEX color value or one of 'purpleRock', 'diceOfRolling', 'galvanized'.|
|scale|4| Options are best between 2-9. The higher the number the larger the dice. Accepts decimal numbers |

### Die Types
This documentation makes frequent reference to common dice notations such as `5d6` where the first number represents the number of dice to roll and the `d#` represents the number of sides on a die. Currently support dice are `d4`, `d6`, `d8`, `d10`, `d12`, `d20`, and `d100`

### Common Objects
#### Roll Object
```javascript
{
  modifier: int,   // optional - the modifier (positive or negative) to be added to the final results
  qty: int,        // the number of dice to be rolled
  sides: int,      // the type of die to be rolled
  theme: string,    // optional - the theme for this roll
}
```

#### Individual Die Result Object
```javascript
{
  groupId: int,    // the roll group this die belongs to
  rollId: int,     // the unique identifier for this die within the group
  sides: int,      // the type of die
  theme: string,   // the theme that was assigned to this die
  value: int,      // the roll result for this die
}
```

#### Roll Result Array Object
```javascript
[
  {                    // the roll group object
    id: 0,             // the id of this group - should match the groupId of rolls
    modifier: int,     // the modifier that was added to the final value
    qty: int,          // the number of dice in this roll
    rolls: [           // an array of Die Result Objects
      {
        groupId: int,
        rollId: int,
        sides: int,
        theme: string,
        value: int,
      }
    ],
    sides: int,        // the type of die used
    theme: string      // the theme for this group of dice
    value: int         // the sum of the dice roll results and modifier
  }
]
```
The result object for `3d6` will look something like this
```javascript
[
  {
    qty: 3,
    sides: 6,
    mods: [],
    rolls: [
      {
        sides: 6,
        groupId: 0,
        rollId: 0,
        theme: 'diceOfRolling',
        value: 5
      },
      {
        sides: 6,
        groupId: 0,
        rollId: 1,
        theme: 'diceOfRolling',
        value: 2
      },
      {
        sides: 6,
        groupId: 0,
        rollId: 2,
        theme: 'diceOfRolling',
        value: 3
      }
    ],
    id: 0,
    value: 10
  }
]
```

#### What's the difference between `groupId`, and `rollId`?
__groupId__: the roll group this die is a part of. This becomes more useful with the advanced dice roller that accepts notations such as `2d10+2d6`. In this case `groupId: 0` would be assigned to the 2d10 and `groupId: 1` would be assigned to the 2d6

__rollId__: the id of the die within the group. By default this is incremented automatically by the dice roller, however there are cases where the rollId is assigned, such as exploding die. In this case, in order to make an association between the 'exploder' and the 'explodee' the rollId of the added die is set to a decimal value of the triggering die. For example with 1d6 that explodes twice: 
```javascript
[
  {
    qty: 3,
    sides: 6,
    mods: [
      {
        type: 'explode',
        target: null
      }
    ],
    rolls: [
      {
        sides: 6,
        groupId: 0,
        rollId: 0,
        theme: 'diceOfRolling',
        value: 6
      },
      {
        sides: 6,
        groupId: 0,
        rollId: 0.1,
        theme: 'diceOfRolling',
        value: 6
      },
      {
        sides: 6,
        groupId: 0,
        rollId: 0.2,
        theme: 'diceOfRolling',
        value: 5
      }
    ],
    id: 0,
    value: 17
  }
]
```

## Methods
### Promised based rolls
The methods `.roll()`,`.add()`, `.reroll()` and `.remove()` are all methods that return a promise containing the results of the dice rolled by the callee. So it is possible to write `DiceBox.roll('4d6').then(results => console.log(results))`. Results can also be retrieved from the `onRollComplete` callback event or by using the `.getRollResults()` method (not a promise).

### Roll
A roll will clear current dice and start a new roll. 
```javascript
roll(notation:mixed, options = {theme:string})
```
The notation argument can accept the following roll formats
1. string notation: `'3d6'` or with a simple modifier `'3d6+2'`
2. an array of strings: `['2d10','1d6']`
3. a roll object: `{sides:6, qty:3}`
4. an array of roll objects: `[{qty:2, sides:10},{qty:1, sides:6}]`

The options argument allows for defining a theme for this roll group.

> #### Themes
> Themes can be specified in three places. On the config object at initialization, as an options parameter when using `.roll()` or `.add()`, or as specified on a _roll object_ or _die result object_. Themes are applied in the order of _roll object_ first, options parameter second and box config option third.

```javascript
diceBox.roll('2d20',{theme:'#4b8968'}) // returns a Promise with an array of die results
```

### Add
This method will add the specified notation to the current roll in a new roll group.
```javascript
add(notation:mixed, options = {theme:string, newStartPoint:boolean})
```
The acceptable arguments are the same as `.roll()`.
The option `newStartPoint` will toss the dice in from a new point along the edge of the box (defaults to true)
```javascript
diceBox.add('1d8',{newStartPoint: false}) // returns a Promise with an array of die results for the dice that were added
```

### Reroll
This method will reroll a die.
```javascript
reroll(notation:mixed, options = {remove:boolean, newStartPoint:boolean})
```
The notation argument here requires an roll object or an array of roll objects identifying the roll group `groupId` and die `rollId` you wish to reroll. Die result objects from previous rolls are valid arguments and can be passed in to trigger a reroll.
The remove option indicates the die being rerolled should be removed from the scene.
The option `newStartPoint` will toss the dice in from a new point along the edge of the box (defaults to true).
```javascript
diceBox.reroll({
  groupId: 0,
  rollId: 2
}) // returns a Promise with an array of die results for the dice that were rerolled
```

### Remove
Remove dice from the scene
```javascript
remove(notation:mixed)
```
The notation here is the same a `.reroll()`
```javascript
diceBox.remove({
  groupId: 0,
  rollId: 2
}) // returns a Promise with an array of die results for the dice that were removed
```

### Clear
This will clear all dice from the dice box.
```javascript
diceBox.clear()
```

### Hide
This will hide the canvas element that the dice box is rendered to.
```javascript
diceBox.hide()
```

### Show
This will show the canvas element that the dice box is rendered to.
```javascript
diceBox.show()
```

### Get Roll Results
Get the results of all the dice in the scene at anytime. However, if dice are still rolling they will not have a value yet.
```javascript
diceBox.getRollResults() // returns an array of roll result objects
```

## Callbacks
### onDieComplete
This callback is triggered whenever an individual die has completed rolling and contains the die result object as it's argument.
```javascript
Box.onDieComplete = (dieResult) => console.log('die result', dieResult)
```

### onRollComplete
This callback is triggered whenever all the dice have finished rolling and/or the physics simulation has been stopped and contains the roll result object as it's argument.
```javascript
Box.onRollComplete = (rollResult) => console.log('roll results', rollResult)
```

### onRemoveComplete
This callback is triggered whenever a die has been removed from the scene and contains the die result object that was removed as it's argument..
```javascript
Box.onRemoveComplete = (dieResult) => console.log('die removed', dieResult)
```

## Other setup options
In my demo project I have it set up as seen below. You probably won't need the `BoxControls` but they're fun to play with. See this demo in Code Sandbox here: https://codesandbox.io/s/3d-dice-demo-2bily5
```javascript
import './style.css'
import DiceBox from '@3d-dice/dice-box'
import { DisplayResults, AdvancedRoller, BoxControls } from '@3d-dice/fui'

let Box = new DiceBox("#dice-box",{
  assetPath: '/assets/dice-box/',
})

document.addEventListener("DOMContentLoaded", async() => {

  Box.init().then(()=>{
    const Controls = new BoxControls({
      onUpdate: (updates) => {
        Box.updateConfig(updates)
      }
    })	
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

  })
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
If you're looking for a 3D dice roller that works with [three.js](https://threejs.org/) than I would recommend looking into [Dice So Nice](https://gitlab.com/riccisi/foundryvtt-dice-so-nice/-/tree/master)
