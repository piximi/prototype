import React, {
  ReactDOM,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { Canvas } from "react-three-fiber";
import { CanvasTexture } from "react-three-fiber/components";
import { createPortal } from "react-dom";

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

  const stageRef = React.useRef<Stage>(null);
  const canvasRef = useRef<HTMLCanvasElement | undefined>();
  const transformerRef = React.useRef<Transformer>(null);
  const imageRef = React.useRef<ImageKonvaType>(null);
  const [annotated, setAnnotated] = useState<boolean>(false);
  const [annotating, setAnnotating] = useState<boolean>(false);

  const [canvas, setCanvas] = useState<HTMLCanvasElement | undefined>();

  useEffect(() => {
    setCanvas(canvasRef.current);
  }, [canvasRef.current]);

  const [magneticSelectionAnchor, setMagneticSelectionAnchor] = useState<{
    x: number;
    y: number;
  }>();
  const [
    magneticSelectionAnnotation,
    setMagneticSelectionAnnotation,
  ] = useState<{ points: Array<number> }>();
  const [
    magneticSelectionCanClose,
    setMagneticSelectionCanClose,
  ] = useState<boolean>(false);
  const [
    magneticSelectionDownsizedWidth,
    setMagneticSelectionDownsizedWidth,
  ] = useState<number>(0);
  const [
    magneticSelectionFactor,
    setMagneticSelectionFactor,
  ] = useState<number>(1);
  const [
    magneticSelectionGraph,
    setMagneticSelectionGraph,
  ] = useState<Graph | null>(null);
  const [
    magneticSelectionPreviousStroke,
    setMagneticSelectionPreviousStroke,
  ] = useState<Array<{ points: Array<number> }>>([]);
  const [magneticSelectionStart, setMagneticSelectionStart] = useState<{
    x: number;
    y: number;
  }>();
  const [magneticSelectionStrokes, setMagneticSelectionStrokes] = useState<
    Array<{ points: Array<number> }>
  >([]);
  const magneticSelectionPosition = React.useRef<{
    x: number;
    y: number;
  } | null>(null);
  const magneticSelectionDebouncedPosition = useDebounce(
    magneticSelectionPosition.current,
    20
  );
  const magneticSelectionPathCoordsRef = React.useRef<any>();
  const magneticSelectionPathFinder = React.useRef<PathFinder<any>>();
  const magneticSelectionRef = React.useRef<Line>(null);
  const magneticSelectionStartPosition = React.useRef<{
    x: number;
    y: number;
  } | null>(null);
  const magneticSelectionStartingAnchorCircleRef = React.useRef<Circle>(null);

  React.useEffect(() => {
    if (magneticSelectionGraph && img) {
      magneticSelectionPathFinder.current = createPathFinder(
        magneticSelectionGraph,
        magneticSelectionDownsizedWidth
      );
    }
    setMagneticSelectionFactor(0.25);
  }, [magneticSelectionDownsizedWidth, magneticSelectionGraph, img]);

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
      setMagneticSelectionDownsizedWidth(img.width * magneticSelectionFactor);
      const downsized = edges.resize({ factor: magneticSelectionFactor });
      setMagneticSelectionGraph(
        makeGraph(downsized.data, downsized.height, downsized.width)
      );
    };
    loadImg();
  }, [image.src, magneticSelectionFactor]);

  React.useEffect(() => {
    if (
      annotated &&
      magneticSelectionRef &&
      magneticSelectionRef.current &&
      transformerRef &&
      transformerRef.current
    ) {
      transformerRef.current.nodes([magneticSelectionRef.current]);

      transformerRef.current.getLayer()?.batchDraw();
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
    const inside = isInside(magneticSelectionStartingAnchorCircleRef, position);
    if (magneticSelectionStrokes && magneticSelectionStrokes.length > 0) {
      return inside && magneticSelectionCanClose;
    }
  };

  const onMagneticSelectionMouseDown = () => {
    if (annotated) {
      return;
    }

    if (stageRef && stageRef.current) {
      magneticSelectionPosition.current = stageRef.current.getPointerPosition();

      if (magneticSelectionPosition && magneticSelectionPosition.current) {
        if (connected(magneticSelectionPosition.current)) {
          const stroke = {
            points: _.flatten(
              magneticSelectionStrokes.map((stroke) => stroke.points)
            ),
          };

          setAnnotated(true);

          setAnnotating(false);

          setMagneticSelectionAnnotation(stroke);
        } else {
          setAnnotating(true);

          magneticSelectionStartPosition.current =
            magneticSelectionPosition.current;

          if (magneticSelectionStrokes.length > 0) {
            setMagneticSelectionAnchor(magneticSelectionPosition.current);

            setMagneticSelectionPreviousStroke([
              ...magneticSelectionPreviousStroke,
              ...magneticSelectionStrokes,
            ]);
          } else {
            setMagneticSelectionStart(magneticSelectionPosition.current);
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

    if (stageRef && stageRef.current) {
      magneticSelectionPosition.current = stageRef.current.getPointerPosition();

      if (magneticSelectionPosition && magneticSelectionPosition.current) {
        if (
          !magneticSelectionCanClose &&
          !isInside(
            magneticSelectionStartingAnchorCircleRef,
            magneticSelectionPosition.current
          )
        ) {
          setMagneticSelectionCanClose(true);
        }

        // let startPosition;
        if (
          magneticSelectionPathFinder &&
          magneticSelectionPathFinder.current &&
          img &&
          magneticSelectionStartPosition &&
          magneticSelectionStartPosition.current
        ) {
          const foundPath = magneticSelectionPathFinder.current.find(
            getIdx(magneticSelectionDownsizedWidth, 1)(
              Math.floor(
                magneticSelectionStartPosition.current.x *
                  magneticSelectionFactor
              ),
              Math.floor(
                magneticSelectionStartPosition.current.y *
                  magneticSelectionFactor
              ),
              0
            ),
            getIdx(magneticSelectionDownsizedWidth, 1)(
              Math.floor(
                magneticSelectionPosition.current.x * magneticSelectionFactor
              ),
              Math.floor(
                magneticSelectionPosition.current.y * magneticSelectionFactor
              ),
              0
            )
          );

          magneticSelectionPathCoordsRef.current = convertPathToCoords(
            foundPath,
            magneticSelectionDownsizedWidth,
            magneticSelectionFactor
          );

          setMagneticSelectionStrokes(
            transformCoordinatesToStrokes(
              magneticSelectionPathCoordsRef.current
            )
          );
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

    if (stageRef && stageRef.current) {
      magneticSelectionPosition.current = stageRef.current.getPointerPosition();

      if (magneticSelectionPosition && magneticSelectionPosition.current) {
        if (connected(magneticSelectionPosition.current)) {
          if (magneticSelectionStart) {
            const stroke = {
              points: [
                magneticSelectionPosition.current.x,
                magneticSelectionPosition.current.y,
                magneticSelectionStart.x,
                magneticSelectionStart.y,
              ],
            };

            setMagneticSelectionStrokes([...magneticSelectionStrokes, stroke]);
          }

          const stroke = {
            points: _.flatten(
              magneticSelectionStrokes.map((stroke) => stroke.points)
            ),
          };

          setAnnotated(true);

          setAnnotating(false);

          setMagneticSelectionAnnotation(stroke);

          setMagneticSelectionStrokes([]);
        } else {
          if (magneticSelectionStrokes.length > 0) {
            setMagneticSelectionAnchor(magneticSelectionPosition.current);

            magneticSelectionStartPosition.current =
              magneticSelectionPosition.current;

            setMagneticSelectionPreviousStroke([
              ...magneticSelectionPreviousStroke,
              ...magneticSelectionStrokes,
            ]);
          } else {
            setMagneticSelectionStart(magneticSelectionPosition.current);
          }
        }
      }
    }
  };

  useEffect(
    () => {
      if (magneticSelectionDebouncedPosition && annotating) {
        onMagneticSelectionMouseMove();
      }
    },
    [
      annotating,
      magneticSelectionDebouncedPosition,
      onMagneticSelectionMouseMove,
    ] // Only call effect if debounced search term changes
  );

  const konvaLayerRefHandler = useCallback(
    (layerNode) => {
      if (layerNode) {
        const sourceCanvas = layerNode.canvas._canvas;
        canvasRef.current = sourceCanvas;
      } else {
        canvasRef.current = undefined;
      }
    },
    [canvasRef]
  );

  return (
    <React.Fragment>
      <Canvas>
        {canvas && (
          <>
            <ambientLight />
            <pointLight position={[10, 10, 10]} />
            <mesh>
              <meshBasicMaterial>
                <CanvasTexture attach="map" args={[canvas]} />
              </meshBasicMaterial>
            </mesh>
          </>
        )}
      </Canvas>
      {createPortal(
        <>
          <ReactKonva.Stage
            globalCompositeOperation="destination-over"
            height={image.shape?.r}
            ref={stageRef}
            width={image.shape?.c}
          >
            <ReactKonva.Layer
              onMouseDown={onMagneticSelectionMouseDown}
              onMouseMove={() => {}}
              onMouseUp={onMagneticSelectionMouseUp}
              ref={konvaLayerRefHandler}
            >
              <ReactKonva.Image image={img} ref={imageRef} />

              {magneticSelectionStart && (
                <ReactKonva.Circle
                  fill="#000"
                  globalCompositeOperation="source-over"
                  hitStrokeWidth={64}
                  id="start"
                  name="anchor"
                  radius={3}
                  ref={magneticSelectionStartingAnchorCircleRef}
                  stroke="#FFF"
                  strokeWidth={1}
                  x={magneticSelectionStart.x}
                  y={magneticSelectionStart.y}
                />
              )}

              {!annotated &&
                annotating &&
                magneticSelectionStrokes.map(
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

              {!annotated &&
                annotating &&
                magneticSelectionPreviousStroke.map(
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

              {magneticSelectionAnchor && (
                <ReactKonva.Circle
                  fill="#FFF"
                  name="anchor"
                  radius={3}
                  stroke="#FFF"
                  strokeWidth={1}
                  x={magneticSelectionAnchor.x}
                  y={magneticSelectionAnchor.y}
                />
              )}

              {magneticSelectionAnnotation && annotated && !annotating && (
                <React.Fragment>
                  <ReactKonva.Line
                    points={magneticSelectionAnnotation.points}
                    stroke="#FFF"
                    strokeWidth={1}
                  />

                  <ReactKonva.Line
                    dash={[4, 2]}
                    points={magneticSelectionAnnotation.points}
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
                ref={transformerRef}
                rotateEnabled={false}
              />
            </ReactKonva.Layer>
          </ReactKonva.Stage>
        </>,
        document.body
      )}
    </React.Fragment>
  );
};
