import { maskDocumentNumber } from "../../lib/documentMask";

interface MaskedDocumentNumberProps {
  value?: string | null;
}

export const MaskedDocumentNumber = ({ value }: MaskedDocumentNumberProps) => {
  const masked = maskDocumentNumber(value);
  if (!masked) return null;
  return <span>{masked}</span>;
};
