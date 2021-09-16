# Dice-Box
High performance 3D dice roller made with BabylonJS, AmmoJS and implemented with web workers and offscreenCanvas.

## Demo
Try out the kitchen sink demo at https://d3rivgcgaqw1jo.cloudfront.net/index.html

This demo includes other `@3d-dice` modules such as [dice-roller-parser](https://github.com/3d-dice/dice-roller-parser), [FUI](https://github.com/3d-dice/FUI), and [FDP](https://github.com/3d-dice/FDP). Advanced dice notation is supported here such as `4d6dl1` or `4d6!r<2`

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

Then create a new instance of the `DiceBox` class. Be sure to set the path to the assets folder copied earlier.
```javascript
const diceBox = new DiceBox({
  assetPath: '/assets/'
})
```

After you initialize the class then it will be ready to roll some dice. The `init` method is an async method so it can be awaited or followed by a `.then()` method.
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
|theme|'nebula'| Options are 'galaxy', 'gemstone', 'glass', 'iron', 'nebula', 'sunrise','sunset', and 'walnut' or you can assign a HEX color value.|
|zoomLevel|3| Options are 0-7. The higher the number the larger the dice.|

### Results Object
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
