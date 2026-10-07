package com.enterprise.knowledge.document.ingestion;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DocumentExtractorsTest {

    @Test
    @DisplayName("TxtDocumentTextExtractor supports txt files and extracts virtual pages")
    void txtExtractorExtraction() throws IOException {
        TxtDocumentTextExtractor extractor = new TxtDocumentTextExtractor();

        assertThat(extractor.supports("test.txt", "text/plain")).isTrue();
        assertThat(extractor.supports("test.pdf", "application/pdf")).isFalse();

        // 100 lines should result in 2 virtual pages (80 lines per virtual page)
        StringBuilder sb = new StringBuilder();
        for (int i = 1; i <= 100; i++) {
            sb.append("Line ").append(i).append("\n");
        }

        ByteArrayInputStream in = new ByteArrayInputStream(sb.toString().getBytes(StandardCharsets.UTF_8));
        ExtractedDocument doc = extractor.extract(in, "test.txt", "text/plain");

        assertThat(doc.pages()).hasSize(2);
        assertThat(doc.pages().get(0).pageNumber()).isEqualTo(1);
        assertThat(doc.pages().get(1).pageNumber()).isEqualTo(2);
        assertThat(doc.pages().get(0).text()).contains("Line 1");
    }

    @Test
    @DisplayName("TxtDocumentTextExtractor throws when txt file is empty")
    void txtExtractorEmptyThrows() {
        TxtDocumentTextExtractor extractor = new TxtDocumentTextExtractor();
        ByteArrayInputStream in = new ByteArrayInputStream("   \n\n  ".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> extractor.extract(in, "empty.txt", "text/plain"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("TXT file is empty");
    }

    @Test
    @DisplayName("PdfDocumentTextExtractor extracts text from valid PDF document")
    void pdfExtractorExtraction() throws IOException {
        PdfDocumentTextExtractor extractor = new PdfDocumentTextExtractor();

        assertThat(extractor.supports("sample.pdf", "application/pdf")).isTrue();
        assertThat(extractor.supports("sample.docx", null)).isFalse();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (PDDocument pdf = new PDDocument()) {
            PDPage page = new PDPage();
            pdf.addPage(page);
            try (PDPageContentStream cs = new PDPageContentStream(pdf, page)) {
                cs.beginText();
                cs.setFont(PDType1Font.HELVETICA, 12);
                cs.showText("Enterprise PDF Ingestion Content");
                cs.endText();
            }
            pdf.save(baos);
        }

        ByteArrayInputStream in = new ByteArrayInputStream(baos.toByteArray());
        ExtractedDocument doc = extractor.extract(in, "sample.pdf", "application/pdf");

        assertThat(doc.pages()).hasSize(1);
        assertThat(doc.pages().getFirst().pageNumber()).isEqualTo(1);
        assertThat(doc.pages().getFirst().text()).contains("Enterprise PDF Ingestion Content");
    }

    @Test
    @DisplayName("PdfDocumentTextExtractor throws when PDF contains no extractable text")
    void pdfExtractorBlankThrows() throws IOException {
        PdfDocumentTextExtractor extractor = new PdfDocumentTextExtractor();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (PDDocument pdf = new PDDocument()) {
            PDPage blankPage = new PDPage();
            pdf.addPage(blankPage);
            pdf.save(baos);
        }

        ByteArrayInputStream in = new ByteArrayInputStream(baos.toByteArray());
        assertThatThrownBy(() -> extractor.extract(in, "blank.pdf", "application/pdf"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("PDF contains no extractable text");
    }

    @Test
    @DisplayName("DocxDocumentTextExtractor extracts headings, paragraphs, and tables")
    void docxExtractorExtraction() throws IOException {
        DocxDocumentTextExtractor extractor = new DocxDocumentTextExtractor();

        assertThat(extractor.supports("report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).isTrue();
        assertThat(extractor.supports("report.txt", "text/plain")).isFalse();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (XWPFDocument docx = new XWPFDocument()) {
            XWPFParagraph h1 = docx.createParagraph();
            h1.setStyle("Heading 1");
            XWPFRun r1 = h1.createRun();
            r1.setText("Architecture Overview");

            XWPFParagraph p = docx.createParagraph();
            XWPFRun r2 = p.createRun();
            r2.setText("This is an enterprise document.");

            XWPFTable table = docx.createTable(2, 2);
            table.getRow(0).getCell(0).setText("Module");
            table.getRow(0).getCell(1).setText("Status");
            table.getRow(1).getCell(0).setText("RAG");
            table.getRow(1).getCell(1).setText("Active");

            docx.write(baos);
        }

        ByteArrayInputStream in = new ByteArrayInputStream(baos.toByteArray());
        ExtractedDocument doc = extractor.extract(in, "report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

        assertThat(doc.pages()).isNotEmpty();
        ExtractedDocument.ExtractedPage page = doc.pages().getFirst();
        assertThat(page.sectionTitle()).isEqualTo("Architecture Overview");
        assertThat(page.text()).contains("Architecture Overview");
        assertThat(page.text()).contains("This is an enterprise document.");
        assertThat(page.text()).contains("| Module | Status |");
        assertThat(page.text()).contains("| RAG | Active |");
    }

    @Test
    @DisplayName("DocxDocumentTextExtractor throws when docx is empty")
    void docxExtractorEmptyThrows() throws IOException {
        DocxDocumentTextExtractor extractor = new DocxDocumentTextExtractor();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (XWPFDocument docx = new XWPFDocument()) {
            docx.write(baos);
        }

        ByteArrayInputStream in = new ByteArrayInputStream(baos.toByteArray());
        assertThatThrownBy(() -> extractor.extract(in, "empty.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("DOCX contains no extractable text");
    }
}
