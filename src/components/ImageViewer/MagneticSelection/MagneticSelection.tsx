import React, { useEffect, useState } from "react";
import * as ReactKonva from "react-konva";
import { Image as ImageType } from "../../../types/Image";
import { Stage } from "konva/types/Stage";
import { Circle } from "konva/types/shapes/Circle";
import { Transformer } from "konva/types/shapes/Transformer";
import * as _ from "underscore";
import { Line } from "konva/types/shapes/Line";
import { Image as ImageKonvaType } from "konva/types/shapes/Image";
import useImage from "use-image";
import {
  convertPathToCoords,
  createPathFinder,
  makeGraph,
} from "../../../image/GraphHelper";
import { Image } from "image-js";
import { Graph } from "ngraph.graph";
import { PathFinder } from "ngraph.path";
import { getIdx } from "../../../image/imageHelper";
import { useDebounce } from "../../../hooks";

type MagneticSelectionProps = {
  image: ImageType;
};

const transformCoordinatesToStrokes = (
  coordinates: number[][]
): Array<{ points: Array<number> }> => {
  const strokes = [];

  for (let index = 0; index < coordinates.length - 1; index++) {
    const [startX, startY] = coordinates[index];
    const [endX, endY] = coordinates[index + 1];

    strokes.push({ points: [startX, startY, endX, endY] });
  }

  return strokes;
};

export const MagneticSelection = ({ image }: MagneticSelectionProps) => {
  const [img] = useImage(image.src, "Anonymous");

  const stage = React.useRef<Stage>(null);
  const startingAnchorCircle = React.useRef<Circle>(null);
  const transformer = React.useRef<Transformer>(null);
  const annotationRef = React.useRef<Line>(null);
  const imageRef = React.useRef<ImageKonvaType>(null);

  const [anchor, setAnchor] = useState<{ x: number; y: number }>();
  const [annotated, setAnnotated] = useState<boolean>(false);
  const [annotating, setAnnotating] = useState<boolean>(false);
  const [annotation, setAnnotation] = useState<{ points: Array<number> }>();
  const [start, setStart] = useState<{ x: number; y: number }>();
  const [strokes, setStrokes] = useState<Array<{ points: Array<number> }>>([]);

  const [previousStroke, setPreviousStroke] = useState<
    Array<{ points: Array<number> }>
  >([]);

  const [downsizedWidth, setDownsizedWidth] = useState<number>(0);
  const [factor, setFactor] = useState<number>(1);

  const [canClose, setCanClose] = useState<boolean>(false);

  const [graph, setGraph] = useState<Graph | null>(null);

  const pathFinder = React.useRef<PathFinder<any>>();

  const position = React.useRef<{ x: number; y: number } | null>(null);
  const startPosition = React.useRef<{ x: number; y: number } | null>(null);

  const pathCoordsRef = React.useRef<any>();

  const debouncedPosition = useDebounce(position.current, 20);

  React.useEffect(() => {
    if (graph && img) {
      pathFinder.current = createPathFinder(graph, downsizedWidth);
    }
    setFactor(0.25);
  }, [downsizedWidth, graph, img]);

  React.useEffect(() => {
    if (imageRef && imageRef.current) {
      imageRef.current.cache();

      imageRef.current.getLayer()?.batchDraw();
    }
  });

  React.useEffect(() => {
    const loadImg = async () => {
      const img = await Image.load(image.src);
      const grey = img.grey();
      const edges = grey.sobelFilter();
      setDownsizedWidth(img.width * factor);
      const downsized = edges.resize({ factor: factor });
      setGraph(makeGraph(downsized.data, downsized.height, downsized.width));
    };
    loadImg();
  }, [image.src, factor]);

  React.useEffect(() => {
    if (
      annotated &&
      annotationRef &&
      annotationRef.current &&
      transformer &&
      transformer.current
    ) {
      transformer.current.nodes([annotationRef.current]);

      transformer.current.getLayer()?.batchDraw();
    }
  }, [annotated]);

  const isInside = (
    startingAnchorCircle: React.RefObject<Circle>,
    position: { x: number; y: number }
  ) => {
    if (startingAnchorCircle && startingAnchorCircle.current) {
      const rectangle = startingAnchorCircle.current.getClientRect();

      return (
        rectangle.x <= position.x &&
        position.x <= rectangle.x + rectangle.width &&
        rectangle.y <= position.y &&
        position.y <= rectangle.y + rectangle.height
      );
    } else {
      return false;
    }
  };

  const connected = (position: { x: number; y: number }) => {
    const inside = isInside(startingAnchorCircle, position);
    if (strokes && strokes.length > 0) {
      return inside && canClose;
    }
  };

  const onMagneticSelectionMouseDown = () => {
    if (annotated) {
      return;
    }

    if (stage && stage.current) {
      position.current = stage.current.getPointerPosition();

      if (position && position.current) {
        if (connected(position.current)) {
          const stroke = {
            points: _.flatten(strokes.map((stroke) => stroke.points)),
          };

          setAnnotated(true);

          setAnnotating(false);

          setAnnotation(stroke);
        } else {
          setAnnotating(true);

          startPosition.current = position.current;

          if (strokes.length > 0) {
            setAnchor(position.current);

            setPreviousStroke([...previousStroke, ...strokes]);
          } else {
            setStart(position.current);
          }
        }
      }
    }
  };

  const onMagneticSelectionMouseMove = () => {
    if (annotated) {
      return;
    }

    if (!annotating) {
      return;
    }

    if (stage && stage.current) {
      position.current = stage.current.getPointerPosition();

      if (position && position.current) {
        if (!canClose && !isInside(startingAnchorCircle, position.current)) {
          setCanClose(true);
        }

        // let startPosition;
        if (
          pathFinder &&
          pathFinder.current &&
          img &&
          startPosition &&
          startPosition.current
        ) {
          const foundPath = pathFinder.current.find(
            getIdx(downsizedWidth, 1)(
              Math.floor(startPosition.current.x * factor),
              Math.floor(startPosition.current.y * factor),
              0
            ),
            getIdx(downsizedWidth, 1)(
              Math.floor(position.current.x * factor),
              Math.floor(position.current.y * factor),
              0
            )
          );

          pathCoordsRef.current = convertPathToCoords(
            foundPath,
            downsizedWidth,
            factor
          );

          setStrokes(transformCoordinatesToStrokes(pathCoordsRef.current));
        }
      }
    }
  };

  const onMagneticSelectionMouseUp = () => {
    if (annotated) {
      return;
    }

    if (!annotating) {
      return;
    }

    if (stage && stage.current) {
      position.current = stage.current.getPointerPosition();

      if (position && position.current) {
        if (connected(position.current)) {
          if (start) {
            const stroke = {
              points: [
                position.current.x,
                position.current.y,
                start.x,
                start.y,
              ],
            };

            setStrokes([...strokes, stroke]);
          }

          const stroke = {
            points: _.flatten(strokes.map((stroke) => stroke.points)),
          };

          setAnnotated(true);

          setAnnotating(false);

          setAnnotation(stroke);

          setStrokes([]);
        } else {
          if (strokes.length > 0) {
            setAnchor(position.current);

            startPosition.current = position.current;

            setPreviousStroke([...previousStroke, ...strokes]);
          } else {
            setStart(position.current);
          }
        }
      }
    }
  };

  useEffect(
    () => {
      if (debouncedPosition && annotating) {
        onMagneticSelectionMouseMove();
      }
    },
    [annotating, debouncedPosition, onMagneticSelectionMouseMove] // Only call effect if debounced search term changes
  );

  return (
    <ReactKonva.Stage
      globalCompositeOperation="destination-over"
      height={image.shape?.r}
      ref={stage}
      width={image.shape?.c}
    >
      <ReactKonva.Layer
        onMouseDown={onMagneticSelectionMouseDown}
        onMouseMove={onMagneticSelectionMouseMove}
        onMouseUp={onMagneticSelectionMouseUp}
      >
        <ReactKonva.Image image={img} ref={imageRef} />

        {start && (
          <ReactKonva.Circle
            fill="#000"
            globalCompositeOperation="source-over"
            hitStrokeWidth={64}
            id="start"
            name="anchor"
            radius={3}
            ref={startingAnchorCircle}
            stroke="#FFF"
            strokeWidth={1}
            x={start.x}
            y={start.y}
          />
        )}

        {!annotated &&
          annotating &&
          strokes.map((stroke: { points: Array<number> }, key: number) => (
            <React.Fragment>
              <ReactKonva.Line
                key={key}
                points={stroke.points}
                stroke="#FFF"
                strokeWidth={1}
              />

              <ReactKonva.Line
                dash={[4, 2]}
                key={key}
                points={stroke.points}
                stroke="#FFF"
                strokeWidth={1}
              />
            </React.Fragment>
          ))}

        {!annotated &&
          annotating &&
          previousStroke.map(
            (stroke: { points: Array<number> }, key: number) => (
              <React.Fragment>
                <ReactKonva.Line
                  key={key}
                  points={stroke.points}
                  stroke="#FFF"
                  strokeWidth={1}
                />

                <ReactKonva.Line
                  dash={[4, 2]}
                  key={key}
                  points={stroke.points}
                  stroke="#FFF"
                  strokeWidth={1}
                />
              </React.Fragment>
            )
          )}

        {anchor && (
          <ReactKonva.Circle
            fill="#FFF"
            name="anchor"
            radius={3}
            stroke="#FFF"
            strokeWidth={1}
            x={anchor.x}
            y={anchor.y}
          />
        )}

        {annotation && annotated && !annotating && (
          <React.Fragment>
            <ReactKonva.Line
              points={annotation.points}
              stroke="#FFF"
              strokeWidth={1}
            />

            <ReactKonva.Line
              dash={[4, 2]}
              points={annotation.points}
              stroke="#FFF"
              strokeWidth={1}
            />
          </React.Fragment>
        )}

        <ReactKonva.Transformer
          anchorFill="#FFF"
          anchorStroke="#000"
          anchorStrokeWidth={1}
          anchorSize={6}
          borderEnabled={false}
          ref={transformer}
          rotateEnabled={false}
        />
      </ReactKonva.Layer>
    </ReactKonva.Stage>
  );
};
