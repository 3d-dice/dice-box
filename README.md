# Dice-Box
High performance 3D dice roller made with BabylonJS, AmmoJS and implemented with web workers and offscreenCanvas.

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


### Promised based rolls
The methods `.roll()`,`.add()`, and `.reroll()` are all methods that return a promise that is resolved when the `dieRollComplete` event is triggered. So it is possible to write `DiceBox.roll('4d6').then(results => console.log(results))`. Results can also be retrieved from the `onRollComplete` callback event.

### Die Result Object
The result for an individual die will look something like this
```json
{
  "groupId": 5,
  "rollId": 29,
  "id": 29,
  "result": 4
}
```

### Roll Results Array Objects
The result object for `3d6` will look something like this
```json
[
  {
    "qty": 3,
    "sides": 6,
    "modifier": 0,
    "rolls": [
      {
        "sides": 6,
        "groupId": 0,
        "rollId": 1,
        "id": 1,
        "theme": "nebula",
        "result": 5
      },
      {
        "sides": 6,
        "groupId": 0,
        "rollId": 2,
        "id": 2,
        "theme": "nebula",
        "result": 6
      },
      {
        "sides": 6,
        "groupId": 0,
        "rollId": 3,
        "id": 3,
        "theme": "nebula",
        "result": 3
      },
    ],
    "value": 14
  }
]
```

#### What's the difference between `groupId`, `rollId` and `id`?
__groupId__: the roll group this die is a part of. This becomes more useful with the advanced dice roller that accepts notations such as `2d10+2d6`. In this case `groupId: 0` would be assigned to the 2d10 and `groupId: 1` would be assigned to the 2d6

__rollId__: the id of the die within the group. By default this is incremented automatically by the dice roller, however there are cases where the rollId is assigned, such as exploding die. In this case, in order to make an association between the 'exploder' and the 'explodee' the rollId of the added die is set to a decimal value of the triggering die. For example with 1d6 that explodes twice: 
```json
[
  {
    "groupId": 0,
    "rollId": 0,
    "id": 0,
    "result": 6
  },
  {
    "groupId": 0,
    "rollId": "0.1",
    "id": 1,
    "result": 6
  },
  {
    "groupId": 0,
    "rollId": "0.2",
    "id": 1,
    "result": 3
  }
]
```
__id__: an auto-incremented number assigned to dice as they are added to the simulation. This id is used to keep the physics simulation synced with the scene being rendered on the canvas. It should never be changed. The id counter is reset on clear.

## Methods
### Roll
A roll will clear current dice and start a new roll. 
```javascript
diceBox.roll('2d20')
```

### Add
This method will add the specified notation to the current roll in a new roll group.
```javascript
diceBox.add('2d6')
```

### Remove
This method requires an object for an argument identifying the roll group and die you wish to remove. This method can only remove one die at a time.
```javascript
diceBox.remove({
  groupId: 0,
  rollId: 2
})
```
You may pass a result roll object into this method to remove that specific die from the box.

### Reroll
Reroll act much like Remove except that it will use the roll object to make another roll of the same die.
```javascript
diceBox.reroll({
  groupId: 0,
  rollId: 2
})
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

## Callbacks
### onDieComplete
This callback is triggered whenever an individual die has completed rolling and contains the die result object as it's argument. It contains the result object for that die
```javascript
Box.onDieComplete = (dieResult) => console.log('die result', dieResult)
```

### onRollComplete
This callback is triggered whenever all the dice have finished rolling and/or the physics simulation has been stopped and contains the roll result object as it's argument.
```javascript
Box.onRollComplete = (rollResult) => console.log('roll results', rollResult)
```

## Other setup options
In my demo project I have it set up as seen below. You probably won't need the `BoxControls` but they're fun to play with.
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
        rolls.forEach(roll => Box.add(roll,roll.groupId))
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
