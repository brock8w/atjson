import { BlockAnnotation } from "@atjson/document";

export class Paragraph extends BlockAnnotation {
  static type = "paragraph";
  static vendorPrefix = "offset";

  get rank() {
    return (super.rank * 3) / 2;
  }
}
