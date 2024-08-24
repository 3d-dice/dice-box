import { useState, useEffect, useRef } from 'react'
import DiceBox from "@3d-dice/dice-box";

/*  --------------- DICE BOX -------------- */
// Note the dice-box assets in the public folder.
// Those files are all necessary for the web workers to function properly
// create new DiceBox class
const Dice = new DiceBox({
    assetPath: "/assets/",
    throwForce: 9,
  }
);

function App() {
  const [rollResult, setRollResult] = useState()

  // create a ref so the Dice Box doesn't try to reinitialize every time the App rerenders.
  const initialized = useRef(false)

  useEffect(()=> {
    if(!initialized.current){
      initialized.current = true
      Dice.init()
    }
  },[])

  // set up the callback for when the dice are finished rolling - https://fantasticdice.games/docs/usage/callbacks
  Dice.onRollComplete = (results) => {
    console.log('results', results)
    setRollResult(results[0].value)
  }

  // handle on form submit
  const handleRoll = (e) => {
    e.preventDefault();
    // get the roll notation from the form input value
    const notation = e.target[0].value
    Dice.roll(notation)
  }

  return (
    <div className="App">
      <h1>Dice Rolling Demo</h1>
      <form id='roller' onSubmit={handleRoll}>
        <input id='notation' type='text' placeholder='3d6' />
        <button type='submit'>Roll</button>
      </form>
      <span id='result'>Result: {rollResult}</span>
    </div>
  )
}

export default App
