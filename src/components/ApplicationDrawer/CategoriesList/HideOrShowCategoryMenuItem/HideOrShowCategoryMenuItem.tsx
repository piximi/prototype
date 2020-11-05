import React from "react";
import MenuItem from "@material-ui/core/MenuItem";
import Typography from "@material-ui/core/Typography";
import { Category } from "../../../../types/Category";
import { useDispatch } from "react-redux";
import { projectSlice } from "../../../../store/slices";

type HideOrShowCategoryMenuItemProps = {
  category: Category;
  onCloseCategoryMenu: () => void;
};

export const HideOrShowCategoryMenuItem = ({
  category,
  onCloseCategoryMenu,
}: HideOrShowCategoryMenuItemProps) => {
  const dispatch = useDispatch();

  const onClick = () => {
    onCloseCategoryMenu();

    const payload = { id: category.id, visible: !category.visible };

    dispatch(projectSlice.actions.updateCategoryVisibilityAction(payload));
  };

  return (
    <MenuItem onClick={onClick}>
      <Typography variant="inherit">
        {category.visible ? "Hide" : "Show"} category
      </Typography>
    </MenuItem>
  );
};
