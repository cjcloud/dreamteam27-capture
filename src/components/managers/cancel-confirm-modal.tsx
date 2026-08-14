interface CancelConfirmModalProps {
  onCancelConfirm: () => void;
  onCancel: () => void;
}

const CancelConfirmModal: React.FC<CancelConfirmModalProps> = ({
  onCancelConfirm,
  onCancel
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-slate-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">
          Are you sure you want to cancel?
        </h3>
        <p className="text-slate-300 mb-6">
          This will clear your current team selection.
        </p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-700 text-slate-100 rounded-md hover:bg-slate-600"
          >
            No, Keep Team
          </button>
          <button
            onClick={onCancelConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500"
          >
            Yes, Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelConfirmModal;
