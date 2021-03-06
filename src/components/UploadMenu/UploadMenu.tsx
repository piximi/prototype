import React from "react";
import { Menu } from "@material-ui/core";
import MenuItem from "@material-ui/core/MenuItem";
import Fade from "@material-ui/core/Fade";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ComputerIcon from "@material-ui/icons/Computer";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import { useStyles } from "./UploadMenu.css";
import { useDispatch } from "react-redux";
import { createImage } from "../../store/slices";
import { DropboxMenuItem } from "../DropboxMenuItem";
import { Shape } from "../../types/Shape";

type UploadMenuProps = {
  anchorEl: HTMLElement | null;
  onClose: (event: any) => void;
  open: boolean;
};

export const UploadMenu = ({ anchorEl, onClose, open }: UploadMenuProps) => {
  const dispatch = useDispatch();
  const classes = useStyles();

  const onUploadFromComputerChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    onClose(event);
    event.persist();
    if (event.currentTarget.files) {
      const blob = event.currentTarget.files[0];

      const reader = new FileReader();

      reader.onload = (event) => {
        if (event.target) {
          const src = event.target.result;

          const image = new Image();

          image.onload = () => {
            const shape: Shape = {
              r: image.naturalHeight,
              c: image.naturalWidth,
              channels: 4,
            };

            dispatch(createImage({ shape: shape, src: src as string }));
          };

          image.src = src as string;
        }
      };

      reader.readAsDataURL(blob);
    }
  };

  return (
    <React.Fragment>
      <input
        accept="image/*"
        hidden
        type="file"
        id="upload-images"
        onChange={onUploadFromComputerChange}
      />
      <Menu
        PaperProps={{ style: { width: 320 } }}
        TransitionComponent={Fade}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        getContentAnchorEl={null}
        onClose={onClose}
        open={Boolean(anchorEl)}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <ListSubheader className={classes.subheader}>Upload from</ListSubheader>

        <label htmlFor="upload-images">
          <MenuItem
            className={classes.item}
            component="span"
            dense
            onClick={onClose}
          >
            <ListItemIcon>
              <ComputerIcon />
            </ListItemIcon>
            <ListItemText primary="Computer" />
          </MenuItem>
        </label>

        <DropboxMenuItem onClose={onClose} />
      </Menu>
    </React.Fragment>
  );
};
