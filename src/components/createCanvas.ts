export const createCanvas = (options: { selector: string; id: string }) => {
  const { selector, id } = options

  if ( !selector ) {
    throw new Error("You must provide a selector in order to render the Dice Box")
  }

  const container = document.querySelector(selector)

  if ( !container ) {
    throw new Error("Selector does not match a container.")
  }

  let canvas: HTMLCanvasElement
  if ( container.nodeName.toLowerCase() !== 'canvas' ) {
    canvas = document.createElement('canvas')
    canvas.id = id
    container.appendChild(canvas)
  } else if (container instanceof HTMLCanvasElement)  {
    canvas = container
  } else {
    throw new Error("The container is not a canvas element.")
  }

  return canvas
}

export default createCanvas