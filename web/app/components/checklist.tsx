import { CheckBoxLine } from '../types/checklist';
import { Box, Checkbox, Skeleton, Text } from '@mantine/core';

interface Props {
  showLoading: boolean;
  checklistLines: CheckBoxLine[];
  updateChecklistLines?: (value: CheckBoxLine[]) => void;
}

export default function Checklist({
  showLoading,
  checklistLines,
  updateChecklistLines,
}: Props) {
  return showLoading ? (
    <>
      <Skeleton height={20} radius="lg" />
      <Skeleton height={20} mt={10} radius="lg" />
      <Skeleton height={20} mt={10} width="70%" radius="lg" />
    </>
  ) : (
    checklistLines.map((line, idx) => (
      <Box pb="2px" key={idx}>
        {line.hasCheckBox ? (
          <Checkbox
            c="var(--tg-theme-button-color)"
            checked={line.isChecked}
            key={idx}
            readOnly={updateChecklistLines === undefined}
            onChange={() => {
              if (!updateChecklistLines) {
                // readonly
                return;
              }
              updateChecklistLines(
                checklistLines.map((otherLine, otherIdx) =>
                  otherIdx === idx
                    ? {
                        ...line,
                        isChecked: !line.isChecked,
                        hasCheckBox: true,
                      }
                    : otherLine
                )
              );
            }}
            label={<Text c="var(--tg-theme-text-color)">{line.text}</Text>}
          ></Checkbox>
        ) : (
          <Text size="lg" c="var(--tg-theme-text-color)">
            {line.text}
          </Text>
        )}
      </Box>
    ))
  );
}
