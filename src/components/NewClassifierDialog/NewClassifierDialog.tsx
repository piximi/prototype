import React from "react";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import TextField from "@material-ui/core/TextField";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";

type NewClassifierDialogProps = {
  onClose: () => void;
  open: boolean;
};

export const NewClassifierDialog = ({
  onClose,
  open,
}: NewClassifierDialogProps) => {
  return (
    <Dialog fullWidth onClose={onClose} open={open}>
      <DialogTitle>New classifier</DialogTitle>

      <DialogContent>
        <TextField autoFocus fullWidth id="name" label="Name" margin="dense" />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button onClick={onClose} color="primary">
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};
