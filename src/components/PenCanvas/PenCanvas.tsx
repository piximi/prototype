import React, { useEffect, useRef, useState } from "react";
import { useStyles } from "./PenCanvas.css";
import { Pen } from "../../image/Pen/Pen";
import { midpoint, Point } from "../../image/Pen/Point";
import { CatenaryCurve } from "../../image/Pen/CatenaryCurve";

type Stroke = {
  color: string;
  radius: number;
  points: Array<{ x: number; y: number }>;
};

type PenCanvasProps = {
  lazyRadius: number;
  tipColor: string;
  tipRadius: number;
  src: string;
};

const drawCatenaryCurve = (
  context: CanvasRenderingContext2D,
  curve: CatenaryCurve,
  a: Point,
  b: Point,
  chainLength: number,
  color: string = "#0a0302"
) => {
  context.beginPath();

  context.lineWidth = 2;

  context.lineCap = "round";

  context.setLineDash([2, 4]);

  context.strokeStyle = color;

  curve.drawToCanvas(context, a, b, chainLength);

  context.stroke();
};

const drawCursor = (
  context: CanvasRenderingContext2D,
  point: Point,
  color: string = "#0a0302",
  radius: number = 4
) => {
  context.beginPath();

  context.fillStyle = color;

  context.arc(point.x, point.y, radius, 0, Math.PI * 2, true);

  context.fill();
};

const drawImage = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number = 0,
  y: number = 0,
  w?: number,
  h?: number,
  offsetX: number = 0.5,
  offsetY: number = 0.5
) => {
  if (!w) w = context.canvas.width;
  if (!h) h = context.canvas.height;

  // keep bounds [0.0, 1.0]
  if (offsetX < 0) offsetX = 0;
  if (offsetY < 0) offsetY = 0;
  if (offsetX > 1) offsetX = 1;
  if (offsetY > 1) offsetY = 1;

  let imageWidth = image.width;
  let imageHeight = image.height;
  let r = Math.min(w / imageWidth, h / imageHeight);
  let updatedWidth = imageWidth * r; // new prop. width
  let updatedHeight = imageHeight * r; // new prop. height
  let cx;
  let cy;
  let cw;
  let ch;
  let ar = 1;

  // decide which gap to fill
  if (updatedWidth < w) ar = w / updatedWidth;
  if (Math.abs(ar - 1) < 1e-14 && updatedHeight < h) ar = h / updatedHeight; // updated

  updatedWidth *= ar;
  updatedHeight *= ar;

  // calc source rectangle
  cw = imageWidth / (updatedWidth / w);
  ch = imageHeight / (updatedHeight / h);

  cx = (imageWidth - cw) * offsetX;
  cy = (imageHeight - ch) * offsetY;

  // make sure source rectangle is valid
  if (cx < 0) cx = 0;
  if (cy < 0) cy = 0;
  if (cw > imageWidth) cw = imageWidth;
  if (ch > imageHeight) ch = imageHeight;

  // fill image in dest. rectangle
  context.drawImage(image, cx, cy, cw, ch, x, y, w, h);
};

const drawPoints = (
  context: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  color: string = "#f2530b",
  radius: number = 2
) => {
  if (points.length < 2) return;

  if (context) {
    context.lineJoin = "round";
    context.lineCap = "round";
    context.strokeStyle = color;

    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    context.lineWidth = radius * 2;

    let p1 = points[0];
    let p2 = points[1];

    context.moveTo(p2.x, p2.y);
    context.beginPath();

    for (let i = 1, len = points.length; i < len; i++) {
      // we pick the point between pi+1 & pi+2 as the
      // end point and p1 as our control point
      const m = midpoint(new Point(p1), new Point(p2));

      context.quadraticCurveTo(p1.x, p1.y, m.x, m.y);
      p1 = points[i];
      p2 = points[i + 1];
    }

    // Draw last line as a straight line while
    // we wait for the next point to be able to calculate
    // the bezier control point
    context.lineTo(p1.x, p1.y);
    context.stroke();
  }
};

const drawPreview = (
  context: CanvasRenderingContext2D,
  point: Point,
  color: string = "#444",
  radius: number = 10
) => {
  context.beginPath();

  context.fillStyle = color;

  context.arc(point.x, point.y, radius, 0, Math.PI * 2, true);

  context.fill();
};

const drawTip = (
  context: CanvasRenderingContext2D,
  point: Point,
  color: string = "#0a0302",
  radius: number = 2
) => {
  context.beginPath();

  context.fillStyle = color;

  context.arc(point.x, point.y, radius, 0, Math.PI * 2, true);

  context.fill();
};

export const PenCanvas = ({
  lazyRadius,
  tipColor,
  tipRadius,
  src,
}: PenCanvasProps) => {
  const interfaceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const temporaryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const requestRef = React.useRef<number>();

  const [
    interfaceCanvasContext,
    setInterfaceCanvasContext,
  ] = useState<CanvasRenderingContext2D | null>(null);

  const [
    selectionCanvasContext,
    setSelectionCanvasContext,
  ] = useState<CanvasRenderingContext2D | null>(null);

  const [
    temporaryCanvasContext,
    setTemporaryCanvasContext,
  ] = useState<CanvasRenderingContext2D | null>(null);

  const [
    imageCanvasContext,
    setImageCanvasContext,
  ] = useState<CanvasRenderingContext2D | null>(null);

  const [curve, setCurve] = useState<CatenaryCurve>(new CatenaryCurve());

  const chainLength = lazyRadius * window.devicePixelRatio;

  const [pen, setPen] = useState<Pen>(
    new Pen(
      true,
      new Point({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }),
      lazyRadius * window.devicePixelRatio
    )
  );

  const [strokes, setStrokes] = useState<Array<Stroke>>([]);
  const [moved, setMoved] = useState<boolean>(false);
  const [pressed, setPressed] = useState<boolean>(false);
  const [selecting, setSelecting] = useState<boolean>(false);
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [updated, setUpdated] = useState<boolean>(false);

  const classes = useStyles();

  const getPosition = (
    event: React.MouseEvent | React.TouchEvent
  ): { x: number; y: number } => {
    const boundingClientRect = interfaceCanvasRef.current?.getBoundingClientRect();

    let x: number = (event as React.MouseEvent).clientX;
    let y: number = (event as React.MouseEvent).clientY;

    if (event instanceof TouchEvent) {
      x = event.changedTouches[0].clientX;
      y = event.changedTouches[0].clientY;
    }

    return {
      x: x - boundingClientRect!.left,
      y: y - boundingClientRect!.top,
    };
  };

  const move = (x: number, y: number) => {
    pen.update(new Point({ x: x, y: y }));

    if ((pressed && !selecting) || (!pen.enabled && pressed)) {
      setSelecting(true);

      setPoints([...points, { x: pen.tip.x, y: pen.tip.y }]);
    }

    if (selecting) {
      setPoints([...points, { x: pen.tip.x, y: pen.tip.y }]);

      drawPoints(temporaryCanvasContext!, points, tipColor, tipRadius);
    }

    setMoved(true);
  };

  const onEnd = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();

    onMove(event);

    setSelecting(false);

    setPressed(false);

    save("#444", 10);
  };

  const onMove = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();

    const { x, y } = getPosition(event);

    move(x, y);
  };

  const onStart = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();

    setPressed(true);

    const { x, y } = getPosition(event);

    if (event instanceof TouchEvent) {
      const point = new Point({ x: x, y: y });

      pen.update(point, true);
    }

    move(x, y);
  };

  const save = (color: string, radius: number) => {
    if (points.length < 2) return;

    const stroke = { color: color, points: [...points], radius: radius };

    setStrokes([...strokes, stroke]);

    setPoints([]);

    if (temporaryCanvasRef && temporaryCanvasRef.current) {
      const width = temporaryCanvasRef.current.width;
      const height = temporaryCanvasRef.current.height;

      selectionCanvasContext?.drawImage(
        temporaryCanvasRef.current,
        0,
        0,
        width!,
        height!
      );

      temporaryCanvasContext?.clearRect(0, 0, width!, height!);
    }
  };

  useEffect(() => {
    const animate = () => {
      if (moved || updated) {
        draw(
          interfaceCanvasContext!,
          new Point(pen.getPointerCoordinates()),
          new Point(pen.getTipCoordinates())
        );

        setMoved(false);
        setUpdated(false);
      }

      pen.update(
        new Point({
          x: window.innerWidth / 2 - chainLength / 4,
          y: window.innerHeight / 2,
        }),
        true
      );

      pen.update(
        new Point({
          x: window.innerWidth / 2 + chainLength / 4,
          y: window.innerHeight / 2,
        }),
        false
      );

      setMoved(true);
      setUpdated(true);

      // clear();

      // if (this.props.saveData) {
      //   this.loadSaveData(this.props.saveData);
      // }
    };

    const clear = () => {
      setStrokes([]);

      setUpdated(true);

      selectionCanvasContext?.clearRect(
        0,
        0,
        selectionCanvasRef.current!.width,
        selectionCanvasRef.current!.height
      );

      temporaryCanvasContext?.clearRect(
        0,
        0,
        temporaryCanvasRef.current!.width,
        temporaryCanvasRef.current!.height
      );
    };

    const draw = (context: CanvasRenderingContext2D, a: Point, b: Point) => {
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);

      drawPreview(context, b);

      drawCursor(context, a);

      if (pen.enabled) {
        drawCatenaryCurve(context, curve, a, b, chainLength);
      }

      drawTip(context, b);
    };

    if (interfaceCanvasRef && interfaceCanvasRef.current) {
      setInterfaceCanvasContext(interfaceCanvasRef.current?.getContext("2d"));
    }

    if (selectionCanvasRef && selectionCanvasRef.current) {
      setSelectionCanvasContext(selectionCanvasRef.current?.getContext("2d"));
    }

    if (temporaryCanvasRef && temporaryCanvasRef.current) {
      setTemporaryCanvasContext(temporaryCanvasRef.current?.getContext("2d"));
    }

    if (imageCanvasRef && imageCanvasRef.current) {
      setImageCanvasContext(imageCanvasRef.current?.getContext("2d"));
    }

    const image = new Image();

    image.crossOrigin = "anonymous";

    image.onload = () => {
      if (imageCanvasContext) {
        drawImage(imageCanvasContext, image);
      }
    };

    image.src = src;

    requestRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(requestRef.current as number);
  }, [
    chainLength,
    curve,
    imageCanvasContext,
    interfaceCanvasContext,
    moved,
    pen,
    src,
    updated,
  ]);

  return (
    <div className={classes.container}>
      <canvas
        className={classes.interface}
        onMouseDown={onStart}
        onMouseMove={onMove}
        onMouseUp={onEnd}
        onTouchCancel={onEnd}
        onTouchEnd={onEnd}
        onTouchMove={onMove}
        onTouchStart={onStart}
        ref={interfaceCanvasRef}
      />
      <canvas className={classes.selection} ref={selectionCanvasRef} />
      <canvas className={classes.temporary} ref={temporaryCanvasRef} />
      {/*<canvas className={classes.image} ref={imageCanvasRef} />*/}
    </div>
  );
};