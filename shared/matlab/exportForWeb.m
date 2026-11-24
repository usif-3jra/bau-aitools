function outFile = exportForWeb(trainedModel, specFile, outFile)
%EXPORTFORWEB  Export a Regression/Classification Learner model for the AI-for-Engineering challenges.
%
%   exportForWeb(trainedModel, '<tool>_spec_<ID>.json')
%
%   trainedModel : struct exported from Regression Learner or Classification Learner
%                  (Export -> Export Model), trained on the dataset CSV of the same tool.
%   specFile     : the EXPORT SPEC file downloaded from the tool page (it fixes the tool,
%                  your ID and the points where the model is evaluated).
%
%   The model is evaluated with trainedModel.predictFcn either on a grid of the
%   predictors (mode 'grid') or on a given list of rows (mode 'predict'), and the
%   results are written to '<tool>_model_<ID>.json'. Any model type works.
%
%   BAU Faculty of Engineering - AI for Engineering challenges. v1.0 - Y. Ajra

    spec = jsondecode(fileread(specFile));
    if ~isfield(spec, 'format') || ~strcmp(spec.format, 'AIENG-SPEC-v1')
        error('AIENG:spec', 'This is not an AI-for-Engineering spec file. Download it from the tool page.');
    end
    if ~isstruct(trainedModel) || ~isfield(trainedModel, 'predictFcn')
        error('AIENG:model', 'trainedModel must be the struct exported from the Learner app (Export -> Export Model).');
    end
    names = cellstr(spec.predictors(:)');
    if isfield(trainedModel, 'RequiredVariables')
        missing = setdiff(cellstr(trainedModel.RequiredVariables), names);
        if ~isempty(missing)
            error('AIENG:vars', 'The model expects {%s}. Import the CSV with readtable so the columns keep their names.', ...
                  strjoin(cellstr(trainedModel.RequiredVariables), ', '));
        end
    end
    if nargin < 3 || isempty(outFile)
        outFile = sprintf('%s_model_%s.json', spec.toolId, spec.studentId);
    end

    switch spec.mode
        case 'grid'
            ax = cellfun(@(n) spec.axes.(n)(:)', names, 'UniformOutput', false);
            g = cell(1, numel(ax));
            [g{:}] = ndgrid(ax{:});                         % first predictor varies fastest
            T = table();
            for k = 1:numel(names), T.(names{k}) = g{k}(:); end
        case 'predict'
            X = spec.X;
            if iscell(X), X = cell2mat(cellfun(@(r) r(:)', X, 'UniformOutput', false)); end
            T = array2table(X, 'VariableNames', names);
        otherwise
            error('AIENG:mode', 'Unknown spec mode %s', spec.mode);
    end

    fprintf('Evaluating the model on %d points ...\n', height(T));
    y = trainedModel.predictFcn(T);
    if strcmp(spec.task, 'classification')
        vals = cellstr(string(y(:)))';
    else
        vals = double(y(:))';
        if any(~isfinite(vals)), error('AIENG:nan', 'The model returned NaN/Inf.'); end
        vals = round(vals * 1e6) / 1e6;
    end

    % ---- describe the model
    mtype = 'Learner app model';
    f = setdiff(fieldnames(trainedModel), {'predictFcn', 'RequiredVariables', 'About', 'HowToPredict', 'ClassNames'});
    k0 = find(cellfun(@(n) isobject(trainedModel.(n)), f), 1);
    if ~isempty(k0)
        cls = class(trainedModel.(f{k0}));
        map = {'GP', 'Gaussian process regression'; 'SVM', 'Support vector machine'; 'ECOC', 'Multiclass SVM (ECOC)'; ...
               'Ensemble', 'Ensemble of trees'; 'Tree', 'Decision tree'; 'NeuralNetwork', 'Neural network'; ...
               'KNN', 'k-nearest neighbours'; 'Discriminant', 'Discriminant analysis'; 'NaiveBayes', 'Naive Bayes'; ...
               'Kernel', 'Kernel approximation'; 'LinearModel', 'Linear regression'; 'Linear', 'Efficient linear'};
        for k = 1:size(map, 1)
            if contains(cls, map{k, 1}), mtype = map{k, 2}; break; end
        end
    end

    S = struct('format', 'AIENG-MODEL-v1', 'toolId', spec.toolId, 'studentId', spec.studentId, ...
               'mode', spec.mode, 'task', spec.task, 'modelType', mtype, 'predictors', {names}, ...
               'values', {vals}, 'created', char(datetime('now', 'Format', 'yyyy-MM-dd HH:mm:ss')), 'matlab', version);
    if strcmp(spec.mode, 'grid'), S.axes = spec.axes; else, S.ids = spec.ids(:)'; end
    fid = fopen(outFile, 'w'); fprintf(fid, '%s', jsonencode(S)); fclose(fid);
    fprintf('Saved %s (%s, %d values). Upload it on the tool page.\n', outFile, mtype, numel(vals));
end
